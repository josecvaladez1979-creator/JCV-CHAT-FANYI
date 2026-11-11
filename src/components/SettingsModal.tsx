import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Scale,
  Mic,
  Cpu,
  Database,
  Wallet,
  X,
  Check,
  Copy,
} from 'lucide-react';

interface LegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  accepted?: boolean;
}

// Completa estos dos datos con los tuyos. Si quedan vacíos, no se muestran.
// Quien trata los datos personales debe poder ser contactado (lo revisa tu abogado).
const RESPONSIBLE_NAME = '';
const CONTACT_EMAIL = '';

// Texto basado en lo que el sistema REALMENTE hace hoy. Debe revisarlo un
// abogado antes de abrir el servicio al público.
export const LEGAL_CLAUSES = [
  {
    id: 'clause-a',
    letter: 'A',
    title: 'Traducción con inteligencia artificial',
    icon: Cpu,
    badge: 'Inteligencia Artificial',
    summary: 'Las traducciones son automáticas y pueden contener errores.',
    legalText: `Las traducciones de JCV CHAT FĀNYÌ las generan de forma automática modelos de inteligencia artificial operados por proveedores externos. No se garantiza que sean exactas, completas ni adecuadas para un fin en particular. Antes de tomar decisiones importantes (comerciales, legales, médicas o de otro tipo) debes verificar el contenido con una persona competente. En la medida permitida por la ley, el servicio se ofrece "tal cual está" y no nos hacemos responsables de pérdidas o daños que resulten de confiar en una traducción automática.`,
  },
  {
    id: 'clause-b',
    letter: 'B',
    title: 'Las traducciones no tienen validez oficial',
    icon: Scale,
    badge: 'Validez legal',
    summary: 'No son traducciones certificadas ni cuentan con fe pública.',
    legalText: `Las traducciones de JCV CHAT FĀNYÌ son informativas y operativas. No son traducciones certificadas ni las realiza un perito traductor autorizado, y no cuentan con fe pública. Si una autoridad, notaría, tribunal o contraparte exige una traducción certificada, debes obtenerla por separado. No nos hacemos responsables si un documento o comunicación es rechazado por no contar con ese requisito.`,
  },
  {
    id: 'clause-c',
    letter: 'C',
    title: 'Qué datos guardamos y con quién los compartimos',
    icon: Database,
    badge: 'Privacidad',
    summary: 'Tus mensajes se guardan en nuestros servidores. Traducir envía el texto a un proveedor externo.',
    legalText: `Guardamos tu nombre, correo electrónico, idioma preferido y tu contraseña (almacenada de forma cifrada e irreversible). También guardamos tus mensajes con su fecha, canal y autor. En los canales con cifrado de extremo a extremo, el mensaje se cifra en tu dispositivo antes de enviarse y se guarda ya cifrado; nosotros no guardamos tu clave. Cuando se traduce un mensaje que no es cifrado, su texto se envía a un proveedor externo de inteligencia artificial, que puede operar fuera de México. Los pagos los procesa un proveedor de pagos externo; no guardamos el número de tu tarjeta. Conservamos los registros de pagos y ventas que exigen las obligaciones contables y fiscales. Para solicitar el acceso, la corrección o la eliminación de tus datos, o para presentar una queja, escríbenos${CONTACT_EMAIL ? ` a ${CONTACT_EMAIL}` : ' al contacto que se indica en este aviso'}.`,
  },
  {
    id: 'clause-d',
    letter: 'D',
    title: 'Voz y datos biométricos (aún no disponible)',
    icon: Mic,
    badge: 'Voz',
    summary: 'Las funciones de voz todavía no existen. Cuando existan, requerirán tu consentimiento expreso.',
    legalText: `Hoy JCV CHAT FĀNYÌ no ofrece funciones de voz. Cuando se agreguen, la clonación de la voz solo se hará con tu consentimiento expreso, grabado por ti mismo, y únicamente con tu propia voz. Está prohibido cargar o usar la voz de otra persona sin su autorización. Podrás solicitar que se elimine tu muestra de voz.`,
  },
  {
    id: 'clause-e',
    letter: 'E',
    title: 'Saldo, vigencia y pagos',
    icon: Wallet,
    badge: 'Saldo',
    summary: 'El chat en tu idioma es gratis. El saldo no consumido al vencer se pierde.',
    legalText: `Chatear en tu mismo idioma es gratis. La traducción con inteligencia artificial y otros servicios se pagan con saldo prepagado, en pesos mexicanos. Cada recarga tiene una vigencia (1 semana, 15 días, 1 mes o 2 meses, según el paquete) que se te muestra antes de pagar. El saldo que no consumas antes de su vencimiento se pierde. Si recargas antes de que venza, el saldo que te quede se suma a tu nueva recarga y se conserva la mayor vigencia entre la actual y la del nuevo paquete. El saldo solo se acredita cuando el proveedor de pagos confirma tu pago.`,
  },
];

export const LegalTermsModal: React.FC<LegalTermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#0c0e14] border border-amber-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-[#121520] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-semibold block">
                Información importante
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Términos y aviso de privacidad
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed font-sans">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Lo más importante, en pocas palabras</span>
            </div>
            <ul className="text-slate-300 text-[11px] leading-relaxed list-disc pl-4 space-y-1">
              <li>Chatear en tu mismo idioma es gratis.</li>
              <li>Tus mensajes se guardan en nuestros servidores (los cifrados, ya cifrados).</li>
              <li>Al traducir un mensaje, su texto se envía a un proveedor externo de IA.</li>
              <li>Las traducciones son automáticas y pueden tener errores.</li>
              <li>El saldo que no uses antes de su vencimiento se pierde.</li>
            </ul>
          </div>

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
                      <h3 className="font-bold text-sm text-white flex items-center gap-2">
                        <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{clause.title}</span>
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {clause.badge}
                      </span>
                      <button
                        onClick={() => handleCopy(clause.id, clause.legalText)}
                        className="p-1 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                        title="Copiar cláusula"
                        aria-label="Copiar cláusula"
                      >
                        {copiedId === clause.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-300/80">Resumen: {clause.summary}</p>

                  <div className="p-3.5 rounded-xl bg-black/60 border border-slate-800 text-[11px] text-slate-200 leading-relaxed select-text">
                    {clause.legalText}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-[11px] space-y-1">
            <div className="text-slate-200 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Responsable y contacto</span>
            </div>
            {RESPONSIBLE_NAME && <p>Responsable del tratamiento de tus datos: {RESPONSIBLE_NAME}.</p>}
            {CONTACT_EMAIL && <p>Contacto: {CONTACT_EMAIL}</p>}
            <p>
              Este texto puede actualizarse. Si cambia algo importante, te lo avisaremos en la aplicación.
            </p>
          </div>
        </div>

        {/* Pie */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#121520] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-400">Última actualización: noviembre de 2026</span>

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
                <span>He leído y acepto</span>
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
