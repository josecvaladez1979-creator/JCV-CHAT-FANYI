import React, { useState } from 'react';
import {
  Globe2,
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
  onSwitchToVault,
  onOpenLegal,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const { isInstallable, install } = usePWAInstall();

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-30 sticky top-0">
      {/* Left: JCV Logo + Active Channel (#general-fānyì) */}
      <div className="flex items-center gap-2.5 sm:gap-3 truncate">
        {/* Brand mark */}
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-extrabold text-xs tracking-wider shadow-md shadow-indigo-600/25 shrink-0">
          JCV
        </div>

        {/* Current Channel / Chat Name */}
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-slate-100 text-xs sm:text-sm tracking-tight truncate">
            #{activeChannelName}
          </span>
          {isE2EEEnabled && (
            <button
              onClick={onOpenE2EESettings}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors shrink-0"
              title="Cifrado E2EE activo (AES-256)"
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">E2EE</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: Tel 📞, Cam 📹, Planes, Idioma, Usuario */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Tel 📞 Voice Call Button */}
        <button
          onClick={onStartVoiceCall}
          className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 hover:border-emerald-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          title="Llamada de voz E2EE"
        >
          <Phone className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-xs font-semibold">Tel</span>
        </button>

        {/* Cam 📹 Video Call Button */}
        <button
          onClick={onStartVideoCall}
          className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-indigo-400 border border-slate-800 hover:border-indigo-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          title="Llamada de video E2EE"
        >
          <Video className="w-3.5 h-3.5" />
          <span className="hidden md:inline text-xs font-semibold">Video</span>
        </button>

        {/* PWA Install Button (If browser supports install) */}
        {isInstallable && (
          <button
            onClick={install}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 transition-colors"
            title="Instalar App (PWA)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Bóveda Vault B2B Button */}
        {onSwitchToVault && (
          <button
            onClick={onSwitchToVault}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#121214] border border-amber-500/40 hover:border-amber-400 text-[#d4af37] shadow-sm transition-all cursor-pointer"
            title="Ir a Bóveda Criptográfica B2B"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bóveda Vault</span>
            <span className="sm:hidden">Vault</span>
          </button>
        )}

        {/* Planes & Pagos Button */}
        <button
          onClick={onOpenSubscription}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md shadow-amber-500/15 transition-all cursor-pointer"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Planes</span>
        </button>

        {/* Blindaje Legal / TyC Button */}
        {onOpenLegal && (
          <button
            onClick={onOpenLegal}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-amber-500/30 transition-colors cursor-pointer"
            title="Blindaje Legal, Prevención de Demandas y TyC"
          >
            <Scale className="w-3.5 h-3.5 text-amber-400" />
            <span>Blindaje Legal</span>
          </button>
        )}

        {/* Reading Language Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowLangDropdown(!showLangDropdown);
              setShowUserDropdown(false);
            }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 transition-colors"
            title="Idioma de traducción"
          >
            <span className="text-sm">{currentLangObj.flag}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showLangDropdown && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-1.5 z-50 max-h-72 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-800">
                Idioma de Traducción Qwen
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

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
          title="Ajustes e IA SiliconFlow"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User avatar / profile dropdown */}
        <div className="relative">
          {currentUser ? (
            <button
              onClick={() => {
                setShowUserDropdown(!showUserDropdown);
                setShowLangDropdown(false);
              }}
              className="p-0.5 rounded-full hover:ring-2 hover:ring-indigo-500 transition-all"
            >
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700"
              />
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
                  <span>Planes (15d / 1m / 1y)</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onOpenE2EESettings();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-slate-300 hover:bg-slate-800 text-left transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cifrado E2EE (Clave de Sala)</span>
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
                    <span>Blindaje Legal & TyC</span>
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
                  <span>Cambiar de Usuario</span>
                </button>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-950/30 text-left transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
