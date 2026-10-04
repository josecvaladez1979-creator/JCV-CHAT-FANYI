import React, { useState } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Globe2,
  Lock,
  ArrowRight,
  Sparkles,
  Users,
} from 'lucide-react';
import { User, SUPPORTED_LANGUAGES, LanguageCode } from '../types';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  availableUsers: User[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  availableUsers,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('es');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.login({ email });
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Usuario no encontrado');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.register({
        name,
        email,
        preferredLanguage,
      });
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPersonaSelect = async (user: User) => {
    setLoading(true);
    try {
      const res = await api.login({ userId: user.id });
      onLoginSuccess(res.user);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-lg mb-3 shadow-lg shadow-indigo-600/30">
            JCV
          </div>
          <h3 className="text-xl font-bold text-slate-100">JCV CHAT FĀNYÌ</h3>
          <p className="text-xs text-slate-400 mt-1">
            Acceso a la plataforma de traducción en tiempo real con Qwen
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex p-1 bg-slate-800/80 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'login'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === 'register'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {tab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Iniciando sesión...' : 'Entrar a JCV CHAT'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre Completo
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="ej. Carlos Mendoza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tu Idioma Nativo (Para recibir traducciones Qwen)
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value as LanguageCode)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name} ({l.nativeName})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Creando cuenta...' : 'Registrar y Comenzar'}</span>
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Quick Demo Personas 1-click */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="text-[11px] font-semibold text-slate-400 mb-2.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>O entra al instante como usuario demo:</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {availableUsers.slice(0, 4).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleQuickPersonaSelect(u)}
                className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 flex items-center gap-2 text-left transition-colors cursor-pointer"
              >
                <img
                  src={u.avatar}
                  alt={u.name}
                  className="w-6 h-6 rounded-full object-cover shrink-0"
                />
                <div className="truncate">
                  <span className="text-xs font-semibold text-slate-200 block truncate">{u.name}</span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">{u.preferredLanguage}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
