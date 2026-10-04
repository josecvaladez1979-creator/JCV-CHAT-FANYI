import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Scale,
  FileText,
  Lock,
  Mic,
  Cpu,
  Flame,
  X,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface LegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  accepted?: boolean;
}

export const LEGAL_CLAUSES = [
  {
    id: 'clause-a',
    letter: 'A',
    title: 'Exclusión de Responsabilidad por Precisión de la IA (Traducción Automatizada)',
    icon: Cpu,
    badge: 'Inteligencia Artificial',
    summary: 'Traducciones automatizadas provistas "tal cual está" (as is) mediante modelos neuronales Qwen.',
    legalText: `El usuario acepta y reconoce que las funciones de traducción de texto, audio, llamadas y videollamadas son generadas de manera automatizada mediante modelos de lenguaje de Inteligencia Artificial (incluyendo Qwen3-32B y Qwen2-Audio-7B). JCV CHAT FĀNYÌ no garantiza la precisión absoluta, infalibilidad o corrección contextual del 100% de las traducciones. Bajo ninguna circunstancia la plataforma o sus desarrolladores serán responsables por pérdidas financieras, rupturas de negociaciones, malentendidos comerciales, daños directos o indirectos derivados de una traducción imprecisa, errónea o incompleta. El servicio se proporciona 'tal cual está' (as is).`,
  },
  {
    id: 'clause-b',
    letter: 'B',
    title: 'Deslinde de Peritaje y Validez Oficial',
    icon: Scale,
    badge: 'Validez Legal & Oficial',
    summary: 'Sin fe pública judicial. Requiere verificación si se exige Perito Traductor Oficial.',
    legalText: `Las traducciones provistas por JCV CHAT FĀNYÌ son de carácter estrictamente técnico, operativo, comercial e informativo. La plataforma NO provee servicios de peritaje traductor oficial, ni cuenta con fe pública judicial o gubernamental. Es responsabilidad exclusiva del usuario verificar si sus contrapartes o las autoridades correspondientes requieren una Traducción Certificada (sello y firma de Perito Traductor Oficial). La plataforma no se hace responsable por el rechazo de documentos o comunicaciones ante tribunales, notarías, registros o dependencias gubernamentales.`,
  },
  {
    id: 'clause-c',
    letter: 'C',
    title: 'Política de Uso de Datos Biométricos (Clonación de Voz original)',
    icon: Mic,
    badge: 'Datos Biométricos & Voz',
    summary: 'Prohibición estricta de suplantación. Uso exclusivo para réplica de voz propia autorizada.',
    legalText: `La función de clonación de voz integrada en la plataforma está diseñada exclusivamente para que el usuario replique su propia identidad vocal con fines de comunicación legítima. Queda estrictamente prohibido cargar, procesar o utilizar archivos de audio, voz o datos biométricos de terceros sin su consentimiento expreso y por escrito. El usuario asume toda la responsabilidad legal (civil y penal) derivada del uso indebido de esta función, incluyendo cargos por suplantación de identidad, fraude o violación de los derechos de propiedad intelectual y privacidad de terceros.`,
  },
  {
    id: 'clause-d',
    letter: 'D',
    title: 'Cláusula de Procesamiento Efímero y Privacidad de Datos (Fānyì Vault)',
    icon: Flame,
    badge: 'Privacidad LFPDPPP / GDPR',
    summary: 'Zero Disk Storage: Purga criptográfica en memoria RAM volátil. Imposibilidad de recuperación.',
    legalText: `En cumplimiento con la legislación aplicable en protección de datos personales (incluyendo la LFPDPPP y el GDPR), JCV CHAT FĀNYÌ garantiza que todo el flujo de datos correspondiente a chats de texto, archivos de audio, llamadas y videollamadas es procesado de manera efímera bajo la arquitectura 'Fānyì Vault' (procesamiento exclusivo en memoria RAM volátil con Zero Disk Storage). Las conversaciones no son resguardadas, almacenadas ni respaldadas en discos duros físicos ni bases de datos permanentes, y se destruyen inmediatamente al finalizar la sesión. Debido a esta purga criptográfica automática, la plataforma se encuentra materialmente imposibilitada para recuperar, exportar o entregar historiales de llamadas o conversaciones a los usuarios o a terceros.`,
  },
];

export const LegalTermsModal: React.FC<LegalTermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  accepted = false,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#0c0e14] border border-amber-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-[#121520] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-semibold block">
                BLINDAJE LEGAL CORPORATIVO & B2C
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Términos, Condiciones y Prevención de Demandas</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  LFPDPPP & GDPR
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar términos"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed font-sans">
          {/* Executive Overview Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs font-mono">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>AVISO LEGAL OBLIGATORIO PARA USUARIOS Y EMPRESAS</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              El uso de JCV CHAT FĀNYÌ y la suite Fānyì Vault implica la aceptación plena de las siguientes cuatro cláusulas esenciales de blindaje legal, limitación de responsabilidad y privacidad de datos biométricos.
            </p>
          </div>

          {/* Clauses list */}
          <div className="space-y-5">
            {LEGAL_CLAUSES.map((clause) => {
              const Icon = clause.icon;
              return (
                <div
                  key={clause.id}
                  className="p-5 rounded-2xl bg-[#121520] border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold font-mono text-xs">
                        {clause.letter}
                      </div>
                      <h3 className="font-bold text-sm text-white">
                        {clause.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {clause.badge}
                      </span>
                      <button
                        onClick={() => handleCopy(clause.id, clause.legalText)}
                        className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                        title="Copiar cláusula legal"
                      >
                        {copiedId === clause.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-300/80 font-mono">
                    Resumen: {clause.summary}
                  </p>

                  <div className="p-3.5 rounded-xl bg-black/60 border border-slate-800 text-[11px] text-slate-200 font-mono leading-relaxed select-text">
                    "{clause.legalText}"
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compliance declaration */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-[11px] space-y-1 font-mono">
            <div className="text-slate-200 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>JURISDICCIÓN Y CUMPLIMIENTO REGULATORIO</span>
            </div>
            <p>
              Plataforma desarrollada conforme a la legislación mercantil y civil aplicable, Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP - México) y Reglamento General de Protección de Datos (GDPR - Unión Europea).
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#121520] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-400 font-mono">
            Última actualización: Octubre 2026 • Versión Enterprise SaaS
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onAccept && (
              <button
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="flex-1 sm:flex-none py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>He leído y acepto los Términos y Blindaje Legal</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
