import React, { useState } from 'react';
import {
  Hash,
  ShieldCheck,
  Plus,
  Users,
  MessageSquare,
  Sparkles,
  Check,
  ChevronRight,
  Phone,
  Video,
} from 'lucide-react';
import { Channel, User, SUPPORTED_LANGUAGES } from '../types';

interface SidebarProps {
  channels: Channel[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  users: User[];
  currentUser: User | null;
  onSwitchUser: (user: User) => void;
  onCreateChannel: (name: string, description: string, isE2EE: boolean) => void;
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
  onSwitchUser,
  onCreateChannel,
  isMobileOpen,
  onCloseMobile,
  onCallUser,
}) => {
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanDesc, setNewChanDesc] = useState('');
  const [newChanE2EE, setNewChanE2EE] = useState(false);

  const handleCreateChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    onCreateChannel(newChanName.trim(), newChanDesc.trim(), newChanE2EE);
    setNewChanName('');
    setNewChanDesc('');
    setNewChanE2EE(false);
    setShowNewChannelModal(false);
  };

  const getLangFlag = (code: string) => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.flag || '🌐';
  };

  return (
    <>
      {/* Mobile backdrop */}
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
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span>Salas y Canales FĀNYÌ</span>
          </div>
          <button
            onClick={() => setShowNewChannelModal(true)}
            className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-white border border-indigo-500/30 transition-colors"
            title="Crear nueva sala o canal E2EE"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span>Canales de Traducción</span>
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
                      {ch.isE2EE && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                          E2EE
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

          {/* Quick Persona Switcher for testing multi-language chat */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Usuarios Multilingües</span>
              </span>
              <span className="text-[10px] text-indigo-400 font-medium">Cambiar 1-Clic</span>
            </div>

            <div className="space-y-1.5">
              {users.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    onClick={() => onSwitchUser(u)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSwitchUser(u);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left border cursor-pointer select-none ${
                      isCurrent
                        ? 'bg-slate-800/90 border-indigo-500/50 text-white shadow-sm'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="relative shrink-0">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-700"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                            u.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                      </div>
                      <div className="truncate">
                        <div className="font-medium text-slate-200 truncate flex items-center gap-1">
                          <span>{u.name}</span>
                          <span>{getLangFlag(u.preferredLanguage)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {u.preferredLanguage.toUpperCase()} • {u.subscriptionPlan || 'Free'}
                        </div>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="text-indigo-400 shrink-0">
                        <Check className="w-4 h-4" />
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {onCallUser && (
                          <>
                            <button
                              type="button"
                              onClick={() => onCallUser(u, 'voice')}
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 transition-colors"
                              title={`Llamar por voz a ${u.name}`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onCallUser(u, 'video')}
                              className="p-1 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-700/60 transition-colors"
                              title={`Videollamada con ${u.name}`}
                            >
                              <Video className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info: SiliconFlow Qwen Free Model Info */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-900/40 text-[11px] text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Qwen3-32B & Qwen2-Audio</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              IAs gratuitas en SiliconFlow para traducción multilingüe 99% y voz a texto.
            </p>
          </div>
        </div>
      </aside>

      {/* New Channel Modal */}
      {showNewChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Hash className="w-5 h-5 text-indigo-400" />
              <span>Crear Nuevo Canal o Sala</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Configura una sala pública o con cifrado de extremo a extremo (E2EE).
            </p>

            <form onSubmit={handleCreateChannelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nombre del canal
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. comercio-china-mexico"
                  value={newChanName}
                  onChange={(e) => setNewChanName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="ej. Discusión de exportaciones con traducción automática"
                  value={newChanDesc}
                  onChange={(e) => setNewChanDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
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
                    Cifrado E2EE (Punto a Punto AES-256)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Los mensajes se cifran en el navegador antes de transmitirse. Solo los usuarios con la clave podrán leerlos.
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
                  Crear Canal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
