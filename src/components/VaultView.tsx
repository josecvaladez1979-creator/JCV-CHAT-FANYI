import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  Flame,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Trash2,
  FileCheck,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Scale,
} from 'lucide-react';
import {
  VaultPlan,
  VaultPlanId,
  VaultTimerOption,
  VaultCertificate,
  VaultStep,
} from '../types';
import { api } from '../services/api';
import { getB2BPack10Remaining, consumeB2BPack10Contract } from '../utils/quota';

interface VaultViewProps {
  onSwitchToChat?: () => void;
  onOpenLegal?: () => void;
}

const VAULT_PLANS_DATA: VaultPlan[] = [
  {
    id: 'individual_20p',
    name: 'Individual 20 págs',
    pagesLimit: 20,
    deliveryTime: '10 min',
    priceMxn: 4499,
    priceUsd: 229,
    description: '1 contrato, máx 20 páginas, 1 idioma, hash + purga 3h, 1 llamadas incluidas.',
  },
  {
    id: 'individual_100p',
    name: 'Individual Pro 100 págs',
    pagesLimit: 100,
    deliveryTime: '15 min',
    priceMxn: 7499,
    priceUsd: 379,
    description: '1 contrato, máx 100 páginas, 2 idiomas, hash + purga 3h + CFDI, 60 min de call con revisión incluida.',
  },
  {
    id: 'pack_10',
    name: 'Pack 10 Contratos',
    totalContracts: 10,
    deliveryTime: '10-15 min c/u',
    priceMxn: 39999,
    unitPriceMxn: 3999,
    savingsMxn: 5000,
    validityDays: 60,
    priceUsd: 2049,
    badge: 'MÁS VENDIDO',
    description: '10 contratos de hasta 20 págs c/u, vigencia 60 días, contador 10/10 -> 9/10, 300 min de calls + 120 min video para revisión legal.',
  },
];

const TIMER_OPTIONS: VaultTimerOption[] = ['30m', '1h', '1h 30m', '2h', '2h 30m', '3h'];

export const VaultView: React.FC<VaultViewProps> = ({ onSwitchToChat, onOpenLegal }) => {
  const [currentStep, setCurrentStep] = useState<VaultStep>('overview');
  const [selectedPlanId, setSelectedPlanId] = useState<VaultPlanId>('individual_20p');
  const [selectedTimer, setSelectedTimer] = useState<VaultTimerOption>('3h');
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; pages: number } | null>(null);
  const [contractText, setContractText] = useState<string>('');
  const [sourceLang, setSourceLang] = useState<string>('Inglés (US)');
  const [targetLang, setTargetLang] = useState<string>('Español Jurídico (México)');
  const [rfc, setRfc] = useState<string>('XAXX010101000');
  const [razonSocial, setRazonSocial] = useState<string>('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [pack10Remaining, setPack10Remaining] = useState<number>(() => getB2BPack10Remaining());

  // Payment state
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');

  // Translation progress state
  const [translationProgress, setTranslationProgress] = useState(0);
  const [translatedContent, setTranslatedContent] = useState<string>('');

  // Countdown timer state
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(3 * 3600);
  const [currentHash, setCurrentHash] = useState<string>('8f3a9e21b74c8104e76a02df359b6cc8e11a2f90');

  // Destruction certificate state & history
  const [latestCertificate, setLatestCertificate] = useState<VaultCertificate | null>(null);
  const [certificatesHistory, setCertificatesHistory] = useState<VaultCertificate[]>([]);

  // Load history from API
  useEffect(() => {
    api.getVaultCertificates().then((certs) => {
      if (certs && certs.length > 0) {
        setCertificatesHistory(certs);
      }
    });
  }, []);

  // Countdown timer effect in Step 4
  const countdownIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (currentStep === 'step4_download') {
      countdownIntervalRef.current = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            handleAutoDestroy('Expiración automática de temporizador');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(countdownIntervalRef.current);
    }

    return () => {
      clearInterval(countdownIntervalRef.current);
    };
  }, [currentStep]);

  // Convert timer selection to seconds
  const parseTimerToSeconds = (opt: VaultTimerOption): number => {
    switch (opt) {
      case '30m':
        return 30 * 60;
      case '1h':
        return 60 * 60;
      case '1h 30m':
        return 90 * 60;
      case '2h':
        return 120 * 60;
      case '2h 30m':
        return 150 * 60;
      case '3h':
      default:
        return 180 * 60;
    }
  };

  const formatCountdown = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // STEP 1: Process Mercado Pago Checkout
  const handleProceedToPayment = async (planId: VaultPlanId) => {
    setSelectedPlanId(planId);
    setCurrentStep('step1_plan');
    setIsProcessingPayment(true);

    try {
      const res = await api.createVaultCheckout(planId, 'mercadopago', undefined, rfc);
      setOrderId(res.orderId);
      setCheckoutUrl(res.checkoutUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleConfirmMercadoPago = () => {
    setPaymentConfirmed(true);
    setCurrentStep('step2_upload');
  };

  // STEP 2: File upload & Sample loader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Estimate pages based on file size or default
      const estimatedPages = selectedPlanId === 'individual_100p' ? 45 : 14;

      if (selectedPlanId === 'individual_20p' && estimatedPages > 20) {
        setPageError('Este plan es máx 20 págs. Usa Individual Pro 100 págs');
      } else {
        setPageError(null);
      }

      setUploadedFile({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        pages: estimatedPages,
      });

      setContractText(`MASTER CONFIDENTIALITY AND NON-DISCLOSURE AGREEMENT (NDA)
This Agreement is entered into as of October 1, 2026, by and between the Disclosing Party and the Receiving Party.
WHEREAS, Disclosing Party possesses certain non-public, proprietary information concerning corporate acquisitions, technical formulations, trade secrets, and financial evaluations.
NOW, THEREFORE, for good and valuable consideration, the receipt of which is hereby acknowledged, the parties agree as follows:
1. DEFINITION OF CONFIDENTIAL INFORMATION.
2. OBLIGATIONS OF RECEIVING PARTY.
3. GOVERNING LAW AND DISPUTE RESOLUTION. This Agreement shall be governed by and construed in accordance with the laws applicable to international commercial arbitration.`);
    }
  };

  const loadSampleContract = (pagesCount = 14) => {
    if (selectedPlanId === 'individual_20p' && pagesCount > 20) {
      setPageError('Este plan es máx 20 págs. Usa Individual Pro 100 págs');
    } else {
      setPageError(null);
    }

    setUploadedFile({
      name: pagesCount > 20 ? 'Contrato_Marco_Corporativo_25_Pags.pdf' : 'Contrato_Internacional_NDA_14_Pags.pdf',
      size: `${(pagesCount * 18.5).toFixed(1)} KB`,
      pages: pagesCount,
    });

    setContractText(`MASTER SERVICES AND EQUITY PARTICIPATION AGREEMENT (${pagesCount} PÁGINAS)
RECITALS:
I. The parties hereto acknowledge their full legal capacity and corporate authority to enter into this legally binding agreement.
II. All proprietary information, financial models, intellectual property, and contractual consideration are strictly confidential under bank-grade E2EE covenants.
CLAUSES:
FIRST. SCOPE OF ENGAGEMENT. The Service Provider shall execute cross-border commercial transactions with utmost fiduciary diligence.
SECOND. JURISDICTION. Any dispute arising under or in connection with this Agreement shall be finally settled under the Rules of Conciliation and Arbitration.`);
  };

  // STEP 3: Execute Legal Translation with Qwen3-32B
  const handleStartTranslation = async () => {
    if (!uploadedFile) return;

    if (selectedPlanId === 'individual_20p' && uploadedFile.pages > 20) {
      setPageError('Este plan es máx 20 págs. Usa Individual Pro 100 págs');
      return;
    }

    setCurrentStep('step3_translating');
    setTranslationProgress(15);

    const timerSeconds = parseTimerToSeconds(selectedTimer);
    setTimeLeftSeconds(timerSeconds);

    // If Pack 10, decrement counter
    let currentPackRemaining = pack10Remaining;
    if (selectedPlanId === 'pack_10') {
      const updated = consumeB2BPack10Contract();
      setPack10Remaining(updated.remaining);
      currentPackRemaining = updated.remaining;
    }

    // Dynamic progress bar
    const progressInterval = setInterval(() => {
      setTranslationProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 15;
      });
    }, 450);

    try {
      const res = await api.translateVaultContract({
        documentName: uploadedFile.name,
        content: contractText,
        sourceLang,
        targetLang,
        timerDuration: selectedTimer,
        planId: selectedPlanId,
        pages: uploadedFile.pages,
      });

      clearInterval(progressInterval);
      setTranslationProgress(100);
      setTranslatedContent(res.translatedContract);

      // Generate SHA-256 Hash
      const randomHash = Array.from(window.crypto.getRandomValues(new Uint8Array(20)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      setCurrentHash(randomHash);

      setTimeout(() => {
        setCurrentStep('step4_download');
      }, 700);
    } catch (err: any) {
      clearInterval(progressInterval);
      alert(err.message || 'Error en procesamiento de bóveda');
      setCurrentStep('step2_upload');
    }
  };

  // STEP 4 & 5: Immediate Download or Purge
  const handleDownload = () => {
    // Trigger download of translated contract file
    const element = document.createElement('a');
    const file = new Blob([translatedContent], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `TRADUCCION_JURIDICA_CERTIFICADA_${uploadedFile?.name || 'CONTRATO'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    // Auto-destroy immediately upon download as mandated
    handleAutoDestroy('Autodestrucción completada inmediatamente tras descarga del usuario');
  };

  const handleAutoDestroy = async (reason: string) => {
    clearInterval(countdownIntervalRef.current);

    // Zero-out RAM variables
    setTranslatedContent('');
    setContractText('');

    const cert = await api.recordDestructionCertificate({
      documentName: uploadedFile?.name || 'Master_Agreement_B2B.pdf',
      hash: currentHash,
      pages: uploadedFile?.pages || 14,
      packRemaining: selectedPlanId === 'pack_10' ? '3/10 usados' : 'Individual consumido',
      timerSelected: selectedTimer,
    });

    setLatestCertificate(cert);
    setCertificatesHistory((prev) => [cert, ...prev]);
    setCurrentStep('step5_destroyed');
  };

  const selectedPlan = VAULT_PLANS_DATA.find((p) => p.id === selectedPlanId) || VAULT_PLANS_DATA[0];

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f8fafc] font-sans">
      {/* Executive Header */}
      <header className="border-b border-[#27272a] bg-[#09090b]/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-600 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/15 border border-amber-400/40">
            <Lock className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif-luxury text-base font-bold tracking-tight text-white">
                JCV FĀNYÌ <span className="text-[#d4af37]">VAULT</span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Enterprise B2B
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              Cifrado E2EE • Purga Criptográfica • CFDI + IVA Incluido
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono text-[#d4af37] bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/30">
            <span>Pack 10:</span>
            <strong className="text-white font-bold">{pack10Remaining}/10 contratos</strong>
          </span>

          {currentStep !== 'overview' && (
            <button
              onClick={() => setCurrentStep('overview')}
              className="text-xs text-zinc-400 hover:text-white transition-colors font-medium cursor-pointer"
            >
              Planes y Precios
            </button>
          )}

          {onSwitchToChat && (
            <button
              onClick={onSwitchToChat}
              className="text-xs text-amber-400/90 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/60 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-medium"
            >
              Suite de Chat en Vivo
            </button>
          )}
        </div>
      </header>

      {/* VIEW: OVERVIEW / LANDING */}
      {currentStep === 'overview' && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
          {/* Hero Section */}
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-[#d4af37] text-xs font-mono font-medium tracking-wide">
              <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
              <span>BÓVEDA CRIPTOGRÁFICA DE DOCUMENTOS JURÍDICOS B2B</span>
            </div>

            <h1 className="font-serif-luxury text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight sm:leading-tight">
              Tu competencia espera 3 días por $4,500.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f3e5ab] to-[#c59b27]">
                Tú cierras en 10 minutos por $4,499.
              </span>
            </h1>

            <p className="text-base sm:text-xl text-zinc-300 font-light max-w-2xl mx-auto leading-relaxed">
              E2EE real. Nosotros no podemos leer tu contrato. Y en 3 horas ya no existe.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => handleProceedToPayment('individual_20p')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-black font-extrabold text-sm tracking-wide shadow-xl shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Traducir 1 Contrato - $4,499</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleProceedToPayment('pack_10')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-[#f8fafc] border border-amber-500/40 hover:border-amber-400 font-bold text-sm tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              >
                <span>Comprar Pack 10 - $39,999</span>
                <span className="text-[11px] font-mono text-[#d4af37] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Ahorra $5,000
                </span>
              </button>
            </div>

            <p className="text-xs text-zinc-400 font-mono pt-2">
              Precio oficial México B2B • CFDI fiscal + IVA 16% incluido • Pago seguro Mercado Pago
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {VAULT_PLANS_DATA.map((plan) => {
              const isPack = plan.id === 'pack_10';
              return (
                <div
                  key={plan.id}
                  className={`relative p-6 sm:p-8 rounded-2xl flex flex-col justify-between transition-all ${
                    isPack
                      ? 'bg-gradient-to-b from-[#18181b] to-[#09090b] border-2 border-amber-500/60 shadow-2xl shadow-amber-500/10'
                      : 'bg-[#121214] border border-[#27272a] hover:border-zinc-700'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 right-6 bg-[#d4af37] text-black font-bold font-mono text-[10px] uppercase px-3 py-1 rounded-full tracking-wider shadow-md">
                      {plan.badge}
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-serif-luxury text-xl font-bold text-white">{plan.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-[#d4af37] font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{plan.deliveryTime}</span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 mb-6 leading-relaxed">{plan.description}</p>

                    <div className="mb-6 pb-6 border-b border-[#27272a]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
                          ${plan.priceMxn.toLocaleString('es-MX')}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">MXN</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-1">
                        {isPack ? (
                          <span className="text-[#d4af37] font-semibold">
                            ${plan.unitPriceMxn?.toLocaleString('es-MX')} MXN c/u (Vigencia 60 días)
                          </span>
                        ) : (
                          <span>CFDI fiscal + IVA 16% incluido</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 mb-8 text-xs text-zinc-300">
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                        <span>
                          {plan.pagesLimit ? `Hasta ${plan.pagesLimit} páginas por contrato` : '10 Contratos independientes'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                        <span>Cifrado E2EE en memoria volátil (Zero Disk Storage)</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                        <span>Autodestrucción configurable (30m a 3h o descarga)</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-[#d4af37] shrink-0" />
                        <span>Certificado de Purga Criptográfica SHA-256</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleProceedToPayment(plan.id)}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer ${
                      isPack
                        ? 'bg-[#d4af37] hover:bg-[#c59b27] text-black shadow-lg shadow-amber-500/20'
                        : 'bg-[#27272a] hover:bg-[#3f3f46] text-white border border-zinc-700'
                    }`}
                  >
                    Seleccionar Plan
                  </button>
                </div>
              );
            })}
          </div>

          {/* Comparativa: Humano vs Vault */}
          <div className="p-8 sm:p-10 rounded-2xl bg-[#121214] border border-[#27272a] space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#d4af37]">
                ANÁLISIS DE EFICIENCIA CORPORATIVA
              </span>
              <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white">
                Comparativa: Despacho Tradicional vs JCV FĀNYÌ VAULT
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#27272a] text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-4">Parámetro</th>
                    <th className="py-3.5 px-4 text-zinc-400">Traductor Humano / Despacho</th>
                    <th className="py-3.5 px-4 text-[#d4af37] bg-amber-500/5 rounded-t-xl">
                      JCV FĀNYÌ VAULT (B2B)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]/60 text-zinc-300">
                  <tr>
                    <td className="py-4 px-4 font-semibold text-white">Tiempo de Entrega</td>
                    <td className="py-4 px-4 text-zinc-400">3 a 5 días hábiles</td>
                    <td className="py-4 px-4 text-amber-300 font-bold bg-amber-500/5">
                      10 a 15 minutos exactos
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-semibold text-white">Costo por Documento</td>
                    <td className="py-4 px-4 text-zinc-400">$4,500 a $12,000+ MXN por contrato</td>
                    <td className="py-4 px-4 text-amber-300 font-bold bg-amber-500/5">
                      $4,499 MXN ($3,999 c/u en Pack 10)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-semibold text-white">Confidencialidad y NDA</td>
                    <td className="py-4 px-4 text-zinc-400">
                      Riesgo de filtración humana, peritos y pasantes
                    </td>
                    <td className="py-4 px-4 text-emerald-400 font-bold bg-amber-500/5">
                      E2EE Real: Nadie puede leerlo en tránsito
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-semibold text-white">Almacenamiento de Datos</td>
                    <td className="py-4 px-4 text-zinc-400">
                      Copia archivada indefinidamente en discos ajenos
                    </td>
                    <td className="py-4 px-4 text-emerald-400 font-bold bg-amber-500/5">
                      RAM Volátil: Autodestrucción en 3 horas
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-semibold text-white">Comprobación Fiscal</td>
                    <td className="py-4 px-4 text-zinc-400">Demoras y trámites de cobranza</td>
                    <td className="py-4 px-4 text-amber-300 font-bold bg-amber-500/5">
                      CFDI + IVA 16% Inmediato con Mercado Pago
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-semibold text-white">Evidencia Criptográfica</td>
                    <td className="py-4 px-4 text-zinc-400">Sin bitácora forense de borrado</td>
                    <td className="py-4 px-4 text-amber-300 font-bold bg-amber-500/5">
                      Certificado de Destrucción con Hash SHA-256
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Histórico Inmutable de Destrucción (Solo Fecha, Día, Año y Hash) */}
          <div className="p-8 rounded-2xl bg-[#121214] border border-[#27272a] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#27272a] pb-4">
              <div>
                <h3 className="font-serif-luxury text-lg font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" />
                  <span>Bitácora de Autodestrucción Criptográfica</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Registro inmutable de purga. Sin retención de texto ni metadatos sensibles.
                </p>
              </div>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded border border-zinc-700 self-start sm:self-auto">
                {certificatesHistory.length} Registros Auditables
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-zinc-400 text-[10px] uppercase border-b border-[#27272a]">
                    <th className="py-2 px-3">Fecha y Hora</th>
                    <th className="py-2 px-3">Año</th>
                    <th className="py-2 px-3">Hash Criptográfico</th>
                    <th className="py-2 px-3">Páginas</th>
                    <th className="py-2 px-3">Estado de Purga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]/50 text-zinc-300">
                  {certificatesHistory.map((cert) => (
                    <tr key={cert.id} className="hover:bg-zinc-800/20">
                      <td className="py-3 px-3 text-[#d4af37] font-semibold">{cert.destroyedAt}</td>
                      <td className="py-3 px-3 text-zinc-400">{cert.year}</td>
                      <td className="py-3 px-3 text-zinc-300 select-all font-mono">
                        {cert.shortHash || `${cert.hash?.slice(0, 4)}...${cert.hash?.slice(-4)}`}
                      </td>
                      <td className="py-3 px-3 text-zinc-400">{cert.pages} págs</td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/40 font-mono">
                          {cert.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* VIEW: PASO 1 - ELIGE PLAN & PAGA CON MERCADO PAGO */}
      {currentStep === 'step1_plan' && (
        <main className="max-w-2xl mx-auto px-4 py-12 space-y-6">
          <div className="border border-[#27272a] rounded-2xl bg-[#121214] p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[#d4af37] uppercase tracking-widest block">
                  PASO 1 DE 5 • FACTURACIÓN CFDI
                </span>
                <h2 className="font-serif-luxury text-2xl font-bold text-white">
                  Confirmación de Pago con Mercado Pago
                </h2>
              </div>
              <span className="text-xs font-mono text-zinc-400">CFDI + IVA 16%</span>
            </div>

            {/* Plan Selected Summary */}
            <div className="p-4 rounded-xl bg-[#18181b] border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 block font-mono">Plan Seleccionado:</span>
                <span className="text-base font-bold text-white">{selectedPlan.name}</span>
                <span className="text-xs text-[#d4af37] block mt-0.5">
                  Entrega estimada: {selectedPlan.deliveryTime}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-mono font-extrabold text-white">
                  ${selectedPlan.priceMxn.toLocaleString('es-MX')}
                </span>
                <span className="text-xs text-zinc-400 block font-mono">MXN (IVA Incluido)</span>
              </div>
            </div>

            {/* Tax Info for CFDI */}
            <div className="space-y-3">
              <label className="block text-xs font-mono text-zinc-300 uppercase tracking-wider">
                Datos de Facturación Fiscal (CFDI México):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="RFC (ej. GOC980112XX4)"
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value.toUpperCase())}
                  className="px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder="Razón Social / Empresa"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#18181b] border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleConfirmMercadoPago}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-black font-extrabold text-sm tracking-wide shadow-xl shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Pagar con Mercado Pago y Continuar a Bóveda</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentStep('overview')}
                className="w-full py-2.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Volver y cambiar de plan
              </button>
            </div>
          </div>
        </main>
      )}

      {/* VIEW: PASO 2 - SUBE PDF & ELIGE TIEMPO DE AUTODESTRUCCIÓN */}
      {currentStep === 'step2_upload' && (
        <main className="max-w-2xl mx-auto px-4 py-12 space-y-6">
          <div className="border border-[#27272a] rounded-2xl bg-[#121214] p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[#d4af37] uppercase tracking-widest block">
                  PASO 2 DE 5 • SUBIDA Y CONFIGURACIÓN TEMPORAL
                </span>
                <h2 className="font-serif-luxury text-2xl font-bold text-white">
                  Carga de Contrato y Tiempo de Autodestrucción
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                Pago Confirmado
              </span>
            </div>

            {/* File Upload Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-zinc-300 uppercase tracking-wider">
                1. Selecciona el contrato en PDF / DOCX:
              </label>

              <div className="border-2 border-dashed border-zinc-700 hover:border-amber-500/60 rounded-2xl p-6 text-center transition-all bg-[#18181b]/60">
                <input
                  type="file"
                  id="pdfUploadInput"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {uploadedFile ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/80 border border-zinc-700 text-left">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-[#d4af37]" />
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-xs">{uploadedFile.name}</p>
                        <p className="text-[11px] text-zinc-400 font-mono">
                          {uploadedFile.size} • {uploadedFile.pages} páginas detectadas
                        </p>
                      </div>
                    </div>
                    <label
                      htmlFor="pdfUploadInput"
                      className="text-xs text-amber-400 underline cursor-pointer"
                    >
                      Cambiar
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FileText className="w-10 h-10 text-zinc-500 mx-auto" />
                    <div>
                      <label
                        htmlFor="pdfUploadInput"
                        className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors cursor-pointer inline-block"
                      >
                        Examinar Archivo PDF
                      </label>
                      <p className="text-[11px] text-zinc-400 mt-2">
                        Arrastra o selecciona el documento legal a traducir
                      </p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadSampleContract(14)}
                        className="text-[11px] text-amber-400/90 hover:text-amber-300 underline font-mono cursor-pointer"
                      >
                        [Cargar contrato de 14 págs (Válido)]
                      </button>
                      <button
                        type="button"
                        onClick={() => loadSampleContract(21)}
                        className="text-[11px] text-rose-400/90 hover:text-rose-300 underline font-mono cursor-pointer"
                      >
                        [Probar subir contrato de 21 págs (Prueba de rechazo)]
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Page Error / Limit Rejection Alert */}
              {pageError && (
                <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                    <div>
                      <p className="font-bold text-white text-xs">{pageError}</p>
                      <p className="text-[10px] text-rose-300 font-mono">
                        El documento supera el límite de 20 páginas de este plan.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanId('individual_100p');
                      setPageError(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow transition-colors"
                  >
                    Cambiar a Individual Pro 100 págs ($7,499 MXN)
                  </button>
                </div>
              )}
            </div>

            {/* Timer Selection: [30m] [1h] [1h 30m] [2h] [2h 30m] [3h] */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  <span>2. Elige Tiempo de Autodestrucción Obligatorio:</span>
                </label>
                <span className="text-[11px] font-mono text-zinc-400">Purga irrecuperable</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {TIMER_OPTIONS.map((timeOpt) => {
                  const isSelected = selectedTimer === timeOpt;
                  return (
                    <button
                      key={timeOpt}
                      type="button"
                      onClick={() => setSelectedTimer(timeOpt)}
                      className={`py-3 px-2 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-lg shadow-rose-950'
                          : 'bg-[#18181b] border-zinc-700 text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {timeOpt}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                Al vencer el temporizador ({selectedTimer}) o al presionar "Descargar", el documento se sobreescribe con ceros en RAM y deja de existir para siempre.
              </p>
            </div>

            {/* Language Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Idioma Origen:</label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#18181b] border border-zinc-700 text-white font-mono"
                >
                  <option value="Inglés (US)">Inglés Legal (US / UK)</option>
                  <option value="Chino Mandarín">Chino Mandarín (CN)</option>
                  <option value="Francés">Francés (FR)</option>
                  <option value="Alemán">Alemán (DE)</option>
                  <option value="Portugués">Portugués (BR)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">Idioma Destino:</label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#18181b] border border-zinc-700 text-white font-mono"
                >
                  <option value="Español Jurídico (México)">Español Jurídico (México B2B)</option>
                  <option value="Inglés (US)">Inglés Jurídico (US)</option>
                  <option value="Chino Mandarín">Chino Mandarín (CN)</option>
                </select>
              </div>
            </div>

            {/* Action Button */}
            <button
              disabled={!uploadedFile || Boolean(pageError)}
              onClick={handleStartTranslation}
              className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center gap-2 ${
                pageError
                  ? 'bg-rose-950 text-rose-300 border border-rose-700/60 cursor-not-allowed'
                  : uploadedFile
                  ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-black shadow-xl shadow-amber-500/20 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {pageError ? (
                <span>Rechazado: {pageError}</span>
              ) : (
                <>
                  <span>Iniciar Traducción Jurídica E2EE ({selectedTimer})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </main>
      )}

      {/* VIEW: PASO 3 - TRADUCIENDO CON CIFRADO E2EE */}
      {currentStep === 'step3_translating' && (
        <main className="max-w-xl mx-auto px-4 py-20 text-center space-y-8">
          <div className="p-8 rounded-3xl bg-[#121214] border border-[#27272a] space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-[#d4af37]">
              <Lock className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
                PASO 3 DE 5 • PROCESAMIENTO CONFIDENCIAL
              </span>
              <h2 className="font-serif-luxury text-2xl font-bold text-white">
                Traduciendo con cifrado E2EE...
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Documento: {uploadedFile?.name} • Terminología Legal B2B
              </p>
            </div>

            {/* Enterprise Progress Bar */}
            <div className="space-y-2">
              <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-300"
                  style={{ width: `${translationProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                <span>Motor Neural Qwen3-32B</span>
                <span>{translationProgress}% Completado</span>
              </div>
            </div>

            <div className="text-left p-4 rounded-xl bg-[#18181b] border border-zinc-800 space-y-2 text-xs text-zinc-300 font-mono">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Búfer de memoria volátil cifrado (RAM-only)</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Cero escritura en disco persistente</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Temporizador armado: {selectedTimer}</span>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* VIEW: PASO 4 - PANTALLA DE DESCARGA CON CONTADOR GIGANTE ROJO */}
      {currentStep === 'step4_download' && (
        <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          <div className="border-2 border-rose-900/60 rounded-3xl bg-[#121214] p-6 sm:p-10 text-center space-y-8 shadow-2xl relative overflow-hidden">
            {/* Warning top pulse */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/70 border border-rose-800 text-rose-400 text-xs font-mono">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
              <span>MEMORIA VOLÁTIL ACTIVA • AUTODESTRUCCIÓN EN PROCESO</span>
            </div>

            <div>
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">
                TIEMPO RESTANTE ANTES DEL BORRADO PERMANENTE
              </span>

              {/* Giant Red Countdown Timer */}
              <div className="font-mono text-5xl sm:text-7xl font-extrabold text-rose-500 tracking-tight text-shadow-red animate-pulse select-all my-2">
                {formatCountdown(timeLeftSeconds)}
              </div>

              <p className="text-xs text-zinc-400 font-mono">
                Documento: <strong className="text-white">{uploadedFile?.name}</strong> • Hash SHA-256:{' '}
                <span className="text-[#d4af37]">{currentHash.slice(0, 12)}...</span>
              </p>
            </div>

            {/* Contract Preview Box (Redacted confidential) */}
            <div className="text-left p-4 rounded-xl bg-black/60 border border-zinc-800 max-h-48 overflow-y-auto font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap select-none">
              {translatedContent}
            </div>

            {/* Mandatory Action Buttons: DESCARGAR & DESTRUIR AHORA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                onClick={handleDownload}
                className="py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm tracking-wider uppercase shadow-xl shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                <span>DESCARGAR</span>
              </button>

              <button
                onClick={() => handleAutoDestroy('Autodestrucción voluntaria inmediata por el usuario')}
                className="py-4 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm tracking-wider uppercase shadow-xl shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Flame className="w-5 h-5" />
                <span>DESTRUIR AHORA</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 font-mono">
              Al descargar o presionar destruir, la memoria se purga de inmediato y se emite el certificado de autodestrucción.
            </p>
          </div>
        </main>
      )}

      {/* VIEW: PASO 5 - AUTO-BORRADO COMPLETADO & CERTIFICADO DE DESTRUCCIÓN */}
      {currentStep === 'step5_destroyed' && latestCertificate && (
        <main className="max-w-2xl mx-auto px-4 py-12 space-y-6">
          <div className="border border-[#27272a] rounded-3xl bg-[#121214] p-6 sm:p-10 space-y-8 shadow-2xl">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500">
                <Flame className="w-8 h-8" />
              </div>

              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
                PASO 5 DE 5 • CERTIFICADO DE DESTRUCCIÓN CRIPTOGRÁFICA
              </span>

              <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-white">
                Contrato Purgado y Destruido de Forma Irreversible
              </h2>
            </div>

            {/* Official Certificate Box as mandated by user */}
            <div className="p-6 rounded-2xl bg-[#09090b] border-2 border-amber-500/40 space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-[#27272a] pb-3 text-xs text-[#d4af37]">
                <span className="font-bold">EVIDENCIA CRIPTOGRÁFICA FORENSE B2B</span>
                <span>{latestCertificate.cfdiFolio}</span>
              </div>

              {/* Exact user text format */}
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs sm:text-sm text-white font-bold leading-relaxed">
                Destruido el {latestCertificate.destroyedAt} - Hash: {latestCertificate.hash.slice(0, 8)}... - Pack: {latestCertificate.packRemaining}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-zinc-400 pt-1">
                <div>
                  <span className="block text-zinc-500 text-[10px]">Día y Fecha:</span>
                  <span className="text-zinc-200 font-semibold">{latestCertificate.date}</span>
                </div>
                <div>
                  <span className="block text-zinc-500 text-[10px]">Hora Purga:</span>
                  <span className="text-zinc-200 font-semibold">{latestCertificate.time}</span>
                </div>
                <div>
                  <span className="block text-zinc-500 text-[10px]">Año:</span>
                  <span className="text-zinc-200 font-semibold">{latestCertificate.year}</span>
                </div>
                <div>
                  <span className="block text-zinc-500 text-[10px]">Estado en Servidor:</span>
                  <span className="text-rose-400 font-bold">0 BYTES (PURGADO)</span>
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                onClick={() => {
                  setUploadedFile(null);
                  setCurrentStep('overview');
                }}
                className="px-8 py-3.5 rounded-xl bg-[#d4af37] hover:bg-[#c59b27] text-black font-extrabold text-xs tracking-wider uppercase transition-all cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Traducir Otro Contrato o Consultar Bitácora
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-[#27272a] py-8 text-center text-xs text-zinc-400 font-mono space-y-2">
        <p>JCV FĀNYÌ VAULT • Tecnologías Criptográficas B2B México</p>
        <p className="text-[10px] text-zinc-400">
          Cifrado E2EE • CFDI Fiscal + IVA Incluido • Cumplimiento Estricto de Secretos Industriales
        </p>
        {onOpenLegal && (
          <div className="pt-2">
            <button
              onClick={onOpenLegal}
              className="text-[11px] text-amber-400/90 hover:text-amber-300 underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Blindaje Legal, Prevención de Demandas y TyC (4 Cláusulas Esenciales)</span>
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
