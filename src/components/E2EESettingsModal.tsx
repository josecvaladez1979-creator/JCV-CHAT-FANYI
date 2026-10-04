import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Key,
  Copy,
  Check,
  RefreshCw,
  QrCode,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { computeSafetyFingerprint } from '../utils/crypto';

interface E2EESettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelName: string;
  currentPassphrase: string;
  onSavePassphrase: (newPassphrase: string) => void;
}

export const E2EESettingsModal: React.FC<E2EESettingsModalProps> = ({
  isOpen,
  onClose,
  channelName,
  currentPassphrase,
  onSavePassphrase,
}) => {
  const [passphrase, setPassphrase] = useState(currentPassphrase);
  const [fingerprint, setFingerprint] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPassphrase(currentPassphrase);
    if (currentPassphrase) {
      computeSafetyFingerprint(currentPassphrase).then(setFingerprint);
    }
  }, [currentPassphrase, isOpen]);

  if (!isOpen) return null;

  const handlePassphraseChange = async (val: string) => {
    setPassphrase(val);
    if (val) {
      const fp = await computeSafetyFingerprint(val);
      setFingerprint(fp);
    } else {
      setFingerprint('');
    }
  };

  const generateRandomKey = async () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let res = '';
    const array = new Uint8Array(24);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < array.length; i++) {
      res += chars[array[i] % chars.length];
    }
    setPassphrase(res);
    const fp = await computeSafetyFingerprint(res);
    setFingerprint(fp);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(passphrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSavePassphrase(passphrase);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Cifrado E2EE (Extremo a Extremo)
            </h3>
            <p className="text-xs text-slate-400">
              Canal: <span className="font-semibold text-slate-200">#{channelName}</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-5">
          Tus mensajes se cifran con <strong className="text-emerald-400">AES-GCM de 256 bits</strong> en tu navegador.
          El servidor de chat solo ve texto cifrado indescifrable. Solo quienes tengan esta misma clave podrán leer y traducir los mensajes.
        </p>

        {/* Passphrase Input */}
        <div className="space-y-4 mb-6">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                Clave Secreta de Cifrado (Passphrase)
              </label>
              <button
                type="button"
                onClick={generateRandomKey}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Generar clave segura</span>
              </button>
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => handlePassphraseChange(e.target.value)}
                placeholder="Ingresa la clave compartida de esta sala..."
                className="w-full px-3.5 py-2.5 pr-20 text-xs sm:text-sm font-mono rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                  title={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 transition-colors"
                  title="Copiar clave"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Safety numbers / Fingerprint */}
          {fingerprint && (
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-semibold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Números de Seguridad (SHA-256 Fingerprint)
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Verificado</span>
              </div>
              <div className="font-mono text-xs text-slate-300 tracking-wider bg-slate-900 p-2 rounded-lg border border-slate-800/80 break-all select-all">
                {fingerprint}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Compara estos números con tus contactos para verificar que nadie ha interceptado la clave.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/25 transition-all"
          >
            Guardar y Aplicar Cifrado
          </button>
        </div>
      </div>
    </div>
  );
};
