import React, { useEffect, useState } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { User, SUPPORTED_LANGUAGES, LanguageCode } from '../types';
import { api } from '../services/api';
import { SUPPORT_EMAIL } from '../contact';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  // Enlace de recuperación entregado por el administrador (si se abrió uno).
  resetToken?: string | null;
  onResetDone?: () => void;
  // Se conserva por compatibilidad con App.tsx. Ya no se usa: se eliminó el
  // acceso "usuario demo", que entraba sin contraseña.
  availableUsers?: User[];
}

const MIN_PASSWORD_CHARS = 12;
const MAX_PASSWORD_BYTES = 72;

function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_CHARS) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_CHARS} caracteres.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return `La contraseña es demasiado larga (máximo ${MAX_PASSWORD_BYTES} bytes).`;
  }
  return null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  resetToken,
  onResetDone,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode>('es');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDoneMsg, setResetDoneMsg] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<{ mxn: number; days: number; chars: number } | null>(null);

  // Si hay saldo de bienvenida encendido, se anuncia en "Crear cuenta".
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api
      .getPricing()
      .then((p: any) => {
        if (!cancelled && p?.welcome) setWelcome(p.welcome);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Al cerrar la ventana, la contraseña vuelve a quedar oculta.
  useEffect(() => {
    if (!isOpen) setShowPassword(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const switchTab = (next: 'login' | 'register') => {
    setTab(next);
    setError(null);
    setPassword('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.login({ email, password });
      setPassword('');
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.register({
        name,
        email,
        password,
        preferredLanguage,
      });
      setPassword('');
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;

    if (password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('La contraseña es demasiado larga (máximo 72 bytes).');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.resetPassword(resetToken, password);
      setResetDoneMsg(res.message || 'Tu contraseña se cambió.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500';
  const passwordInputClass = inputClass.replace('pr-3.5', 'pr-11');

  const eyeButton = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      className="absolute right-2 top-1.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors cursor-pointer"
      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  // Pantalla para elegir una contraseña nueva (se abre con el enlace del administrador).
  if (resetToken) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-lg mb-3 shadow-lg shadow-indigo-600/30">
              JCV
            </div>
            <h3 className="text-xl font-bold text-slate-100">Elige tu nueva contraseña</h3>
            <p className="text-xs text-slate-400 mt-1">
              Este enlace sirve una sola vez y vence en 1 hora.
            </p>
          </div>

          {resetDoneMsg ? (
            <div className="space-y-4 text-center">
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs">
                {resetDoneMsg}
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetDoneMsg(null);
                  setError(null);
                  setTab('login');
                  onResetDone?.();
                }}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-colors cursor-pointer"
              >
                Iniciar sesión
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Mínimo 12 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={passwordInputClass}
                    />
                    {eyeButton}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Repite la contraseña
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Otra vez"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={passwordInputClass}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">Entre 12 caracteres y 72 bytes.</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{loading ? 'Guardando...' : 'Guardar contraseña'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPassword('');
                    setConfirmPassword('');
                    onResetDone?.();
                  }}
                  className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold text-lg mb-3 shadow-lg shadow-indigo-600/30">
            JCV
          </div>
          <h3 className="text-xl font-bold text-slate-100">JCV CHAT FĀNYÌ</h3>
          <p className="text-xs text-slate-400 mt-1">
            Acceso a la plataforma de traducción en tiempo real
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex p-1 bg-slate-800/80 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => switchTab('login')}
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
            onClick={() => switchTab('register')}
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
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs"
          >
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
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={passwordInputClass}
                />
                {eyeButton}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 -mt-1">
              ¿Olvidaste tu contraseña?{' '}
              <a
                className="text-indigo-300 underline"
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Recuperar mi cuenta')}&body=${encodeURIComponent(
                  'Hola, no puedo entrar a mi cuenta.\nMi correo de registro es: ' + email + '\n\n(No incluyas tu contraseña.)'
                )}`}
              >
                Escribe a soporte
              </a>
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Iniciando sesión...' : 'Entrar a JCV CHAT'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {welcome && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs leading-relaxed">
                Al crear tu cuenta recibes <strong>${welcome.mxn} MXN</strong> de saldo de bienvenida para
                probar la traducción (unos {welcome.chars.toLocaleString('es-MX')} caracteres), válido por{' '}
                {welcome.days} días.
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre Completo
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder="ej. Carlos Mendoza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
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
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={MIN_PASSWORD_CHARS}
                  autoComplete="new-password"
                  placeholder={`Mínimo ${MIN_PASSWORD_CHARS} caracteres`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={passwordInputClass}
                />
                {eyeButton}
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Entre {MIN_PASSWORD_CHARS} caracteres y {MAX_PASSWORD_BYTES} bytes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tu Idioma Nativo (para recibir traducciones)
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
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{loading ? 'Creando cuenta...' : 'Registrar y Comenzar'}</span>
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
