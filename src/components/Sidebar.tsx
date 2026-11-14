import React, { useState } from 'react';
import {
  Hash,
  ShieldCheck,
  Plus,
  Users,
  MessageSquare,
  Check,
  Lock,
  Phone,
  Video,
} from 'lucide-react';
import { Channel, User, SUPPORTED_LANGUAGES } from '../types';

// Se conservan las mismas propiedades que usa App.tsx. onSwitchUser ya no se
// usa: cambiar de persona con un clic desapareció, cada quien entra con su cuenta.
interface SidebarProps {
  channels: Channel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  users: User[];
  currentUser: User | null;
  onSwitchUser?: (user: User) => void;
  onCreateChannel: (
    name: string,
    description: string,
    isE2EE: boolean,
    isPrivate?: boolean
  ) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onCallUser?: (user: User, type: 'voice' | 'video') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  channels,
  activeChannelId,
  onSelectChannel,
  users,
  currentUser,
  onCreateChannel,
  isMobileOpen,
  onCloseMobile,
  onCallUser,
}) => {
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanDesc, setNewChanDesc] = useState('');
  const [newChanE2EE, setNewChanE2EE] = useState(false);
  // Por defecto un canal nuevo es PRIVADO: solo entra quien tenga su enlace.
  const [newChanPrivate, setNewChanPrivate] = useState(true);

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    onCreateChannel(newChanName.trim(), newChanDesc.trim(), newChanE2EE, newChanPrivate);
    setNewChanName('');
    setNewChanDesc('');
    setNewChanE2EE(false);
    setNewChanPrivate(true);
    setShowNewChannelModal(false);
  };

  const getLangFlag = (code: string) => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag || '🌐';
  };

  const peers = users.filter((u) => u.id !== currentUser?.id);

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-xs"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-20 w-72 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>Canales</span>
          </div>
          <button
            onClick={() => setShowNewChannelModal(true)}
            className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-white border border-indigo-500/30 transition-colors"
            title="Crear un canal nuevo"
            aria-label="Crear un canal nuevo"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Canales */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span>Tus canales</span>
              <span className="text-[10px] text-slate-500 font-normal">{channels.length}</span>
            </div>

            <div className="space-y-1">
              {channels.map((ch) => {
                const isActive = activeChannelId === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      onSelectChannel(ch.id);
                      onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {ch.isE2EE ? (
                        <ShieldCheck
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-emerald-300' : 'text-emerald-400'
                          }`}
                        />
                      ) : (
                        <Hash
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-indigo-200' : 'text-slate-500'
                          }`}
                        />
                      )}
                      <span className="truncate">{ch.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {ch.isPrivate && (
                        <Lock
                          className="w-3 h-3 text-slate-400"
                          aria-label="Canal privado"
                        />
                      )}
                      {ch.isE2EE && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          Cifrado
                        </span>
                      )}
                      {ch.unreadCount && ch.unreadCount > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500 text-white font-bold">
                          {ch.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Personas de tus canales (solo se muestran, no se "suplantan") */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Personas</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">{peers.length}</span>
            </div>

            <div className="space-y-1.5">
              {peers.length === 0 && (
                <p className="px-3 text-[11px] text-slate-500">
                  Aún no hay otras personas en tus canales. Comparte el enlace de un canal para invitarlas.
                </p>
              )}

              {peers.map((u) => (
                <div
                  key={u.id}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs border bg-slate-900/60 border-slate-800/80 text-slate-300"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700 shrink-0"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full ring-1 ring-slate-700 bg-indigo-700 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        {u.name.trim().charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                    <div className="truncate">
                      <div className="font-medium text-slate-200 truncate flex items-center gap-1">
                        <span>{u.name}</span>
                        <span>{getLangFlag(u.preferredLanguage)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {u.preferredLanguage.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {onCallUser && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onCallUser(u, 'voice')}
                        className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 transition-colors"
                        title="Llamada de voz (próximamente)"
                        aria-label={`Llamar a ${u.name}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCallUser(u, 'video')}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-700/60 transition-colors"
                        title="Videollamada (próximamente)"
                        aria-label={`Videollamada con ${u.name}`}
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie: qué se cobra y qué no */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <Check className="w-3.5 h-3.5" />
              <span>Chat en tu idioma: gratis</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Traducir con IA se paga con saldo. Las traducciones son automáticas y pueden tener errores.
            </p>
          </div>
        </div>
      </aside>

      {/* Crear canal */}
      {showNewChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Hash className="w-5 h-5 text-indigo-400" />
              <span>Crear un canal</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Elige si será privado (solo entra quien tenga el enlace) y si tendrá cifrado de extremo a extremo.
            </p>

            <form onSubmit={handleCreateChannelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nombre del canal
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  placeholder="ej. comercio-china-mexico"
                  value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="ej. Exportaciones con traducción automática"
                  value={newChanDesc}
                  onChange={(e) => setNewChanDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="privateCheckbox"
                  checked={newChanPrivate}
                  onChange={(e) => setNewChanPrivate(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-700 cursor-pointer"
                />
                <label htmlFor="privateCheckbox" className="text-xs cursor-pointer select-none">
                  <span className="font-semibold text-slate-200 block flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Canal privado
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Solo lo ven y entran quienes tengan su enlace. Si lo desmarcas, cualquier persona con cuenta lo verá.
                  </span>
                </label>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="e2eeCheckbox"
                  checked={newChanE2EE}
                  onChange={(e) => setNewChanE2EE(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-700 cursor-pointer"
                />
                <label htmlFor="e2eeCheckbox" className="text-xs cursor-pointer select-none">
                  <span className="font-semibold text-emerald-400 block flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Cifrado de extremo a extremo
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Los mensajes se cifran en tu dispositivo antes de enviarse y no se pueden traducir. Quien los lea necesita la clave, que debes compartirle por otro medio.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChannelModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-colors"
                >
                  Crear canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
