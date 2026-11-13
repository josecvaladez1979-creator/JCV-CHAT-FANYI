import React, { useState } from 'react';
import {
  ShieldCheck,
  CreditCard,
  Settings,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Phone,
  Video,
  Download,
  Scale,
} from 'lucide-react';
import { User, SUPPORTED_LANGUAGES, LanguageCode } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

// Se conservan las mismas propiedades que usa App.tsx. onSwitchToVault ya no
// se usa: Vault fue eliminado.
interface NavbarProps {
  currentUser: User | null;
  selectedLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  activeChannelName: string;
  isE2EEEnabled: boolean;
  onStartVoiceCall: () => void;
  onStartVideoCall: () => void;
  onOpenE2EESettings: () => void;
  onOpenSubscription: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onSwitchToVault?: () => void;
  onOpenLegal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  selectedLanguage,
  onLanguageChange,
  activeChannelName,
  isE2EEEnabled,
  onStartVoiceCall,
  onStartVideoCall,
  onOpenE2EESettings,
  onOpenSubscription,
  onOpenSettings,
  onOpenAuth,
  onLogout,
  onOpenLegal,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const { isInstallable, install } = usePWAInstall();

  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 sticky top-0">
      {/* Izquierda: marca y canal activo */}
      <div className="flex items-center gap-2.5 sm:gap-3 truncate">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-extrabold text-xs tracking-wider shadow-md shadow-indigo-600/25 shrink-0">
          JCV
        </div>

        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-slate-100 text-xs sm:text-sm tracking-tight truncate">
            #{activeChannelName}
          </span>
          {isE2EEEnabled && (
            <button
              onClick={onOpenE2EESettings}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors shrink-0"
              title="Canal con cifrado de extremo a extremo"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">Cifrado</span>
            </button>
          )}
        </div>
      </div>

      {/* Derecha */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Llamadas: aún no disponibles (la aplicación avisa al tocarlas) */}
        <button
          onClick={onStartVoiceCall}
          className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          title="Llamada de voz (próximamente)"
        >
          <Phone className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-xs font-semibold">Tel</span>
        </button>

        <button
          onClick={onStartVideoCall}
          className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-slate-800 hover:border-indigo-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          title="Videollamada (próximamente)"
        >
          <Video className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-xs font-semibold">Video</span>
        </button>

        {isInstallable && (
          <button
            onClick={install}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 transition-colors"
            title="Instalar la aplicación"
            aria-label="Instalar la aplicación"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Saldo y recargas */}
        <button
          onClick={onOpenSubscription}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/15 transition-all cursor-pointer"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Recargar</span>
        </button>

        {onOpenLegal && (
          <button
            onClick={onOpenLegal}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-amber-500/30 transition-colors cursor-pointer"
            title="Términos y aviso de privacidad"
          >
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>Términos y privacidad</span>
          </button>
        )}

        {/* Idioma en el que lees */}
        <div className="relative">
          <button
            onClick={() => {
              setShowLangDropdown(!showLangDropdown);
              setShowUserDropdown(false);
            }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 transition-colors"
            title="Idioma en el que lees"
          >
            <span className="text-sm">{currentLangObj.flag}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showLangDropdown && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-1.5 z-50 max-h-72 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
                Idioma en el que lees
              </div>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onLanguageChange(lang.code);
                    setShowLangDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                    selectedLanguage === lang.code
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{lang.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
          title="Ajustes y traducción"
          aria-label="Ajustes y traducción"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Usuario */}
        <div className="relative">
          {currentUser ? (
            <button
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowLangDropdown(false);
              }}
              className="p-0.5 rounded-full hover:ring-2 hover:ring-indigo-500 transition-all"
              aria-label="Mi cuenta"
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700"
                />
              ) : (
                <span className="w-7 h-7 rounded-full ring-1 ring-slate-700 bg-indigo-700 text-white text-xs font-bold flex items-center justify-center">
                  {currentUser.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}

          {showUserDropdown && currentUser && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50">
              <div className="px-3.5 py-2 border-b border-slate-800">
                <p className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onOpenSubscription();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 text-left transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>Recargar saldo</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onOpenE2EESettings();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 text-left transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cifrado (clave de la sala)</span>
                </button>
                {onOpenLegal && (
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenLegal();
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 text-left transition-colors"
                  >
                    <Scale className="w-3.5 h-3.5 text-amber-400" />
                    <span>Términos y privacidad</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onOpenAuth();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 text-left transition-colors border-t border-slate-800 mt-1"
                >
                  <UserIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>Entrar con otra cuenta</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-950/30 text-left transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
