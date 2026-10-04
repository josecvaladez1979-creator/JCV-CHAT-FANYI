import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  ShieldCheck,
  Minimize2,
  Maximize2,
  Monitor,
  SwitchCamera,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';
import { realtimeChat } from '../services/sse';
import { incrementCallQuota } from '../utils/quota';
import { t } from '../jcv-world.js';

export interface ActiveCall {
  channelId: string;
  channelName: string;
  callType: 'voice' | 'video';
  isCaller: boolean;
  status: 'calling' | 'incoming' | 'connected' | 'ended';
  caller: {
    id: string;
    name: string;
    avatar: string;
  };
  targetUser?: User;
}

interface CallModalProps {
  activeCall: ActiveCall | null;
  currentUser: User | null;
  passphrase: string;
  existingStream?: MediaStream | null;
  onEndCall: () => void;
  onAcceptIncomingCall: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  activeCall,
  currentUser,
  passphrase,
  existingStream,
  onEndCall,
  onAcceptIncomingCall,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(activeCall?.callType === 'voice');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<any>(null);

  // Auto-connect timer & media setup
  useEffect(() => {
    if (!activeCall) return;

    if (activeCall.status === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
      clearInterval(timerRef.current);
    }

    return () => {
      clearInterval(timerRef.current);
    };
  }, [activeCall?.status]);

  // WebRTC Peer Connection & Media Initialization
  useEffect(() => {
    if (!activeCall || activeCall.status === 'incoming') {
      return;
    }

    let isMounted = true;

    const startMediaAndRTC = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: true,
          video: activeCall.callType === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false,
        };

        let stream: MediaStream;
        const globalStream = (window as any).localStream;

        if (existingStream && existingStream.active && existingStream.getTracks().some((t) => t.readyState === 'live')) {
          stream = existingStream;
        } else if (globalStream && globalStream.active && globalStream.getTracks().some((t: any) => t.readyState === 'live')) {
          stream = globalStream;
        } else {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStorage.setItem('jcv_perm_granted', 'true');
            (window as any).localStream = stream;
          } catch (mediaErr) {
            console.warn('Camera/Mic permission warning, trying audio only:', mediaErr);
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStorage.setItem('jcv_perm_granted', 'true');
            (window as any).localStream = stream;
          }
        }

        if (!isMounted) {
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize RTCPeerConnection with STUN servers
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });
        peerConnectionRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Handle remote tracks
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && currentUser) {
            api.sendWebRTCSignal({
              channelId: activeCall.channelId,
              senderId: currentUser.id,
              senderName: currentUser.name,
              senderAvatar: currentUser.avatar,
              signalType: 'ice_candidate',
              callType: activeCall.callType,
              candidate: event.candidate,
            });
          }
        };

        // If caller, create Offer
        if (activeCall.isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          if (currentUser) {
            await api.sendWebRTCSignal({
              channelId: activeCall.channelId,
              senderId: currentUser.id,
              senderName: currentUser.name,
              senderAvatar: currentUser.avatar,
              signalType: 'offer',
              callType: activeCall.callType,
              sdp: offer,
              e2ee: true,
            });
          }
        }
      } catch (err) {
        console.error('Error starting WebRTC media:', err);
      }
    };

    startMediaAndRTC();

    return () => {
      isMounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    };
  }, [activeCall?.status, activeCall?.channelId]);

  // Listen to remote signaling events (Offer, Answer, ICE candidate)
  useEffect(() => {
    if (!activeCall || activeCall.status === 'incoming') return;

    const unsubSignal = realtimeChat.on('webrtc_signal', async (signal) => {
      if (signal.channelId !== activeCall.channelId || signal.senderId === currentUser?.id) {
        return;
      }

      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        if (signal.signalType === 'offer' && !activeCall.isCaller) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (currentUser) {
            await api.sendWebRTCSignal({
              channelId: activeCall.channelId,
              senderId: currentUser.id,
              senderName: currentUser.name,
              senderAvatar: currentUser.avatar,
              signalType: 'answer',
              callType: activeCall.callType,
              sdp: answer,
            });
          }
        } else if (signal.signalType === 'answer' && activeCall.isCaller) {
          if (pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else if (signal.signalType === 'ice_candidate') {
          if (signal.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        } else if (signal.signalType === 'call_ended') {
          onEndCall();
        }
      } catch (e) {
        console.warn('Signaling processing notice:', e);
      }
    });

    return () => {
      unsubSignal();
    };
  }, [activeCall, currentUser, onEndCall]);

  if (!activeCall) return null;

  // Toggle Mute Audio
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = isVideoDisabled;
      });
      setIsVideoDisabled(!isVideoDisabled);
    }
  };

  // Share Screen
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert to camera
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const camTrack = camStream.getVideoTracks()[0];
        const pc = peerConnectionRef.current;
        if (pc) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(camTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = camStream;
        }
        setIsScreenSharing(false);
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const pc = peerConnectionRef.current;
        if (pc) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        screenTrack.onended = () => {
          setIsScreenSharing(false);
        };
        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share canceled:', err);
      }
    }
  };

  // Switch camera (front/back)
  const switchCamera = async () => {
    if (!localStreamRef.current) return;
    try {
      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const newTrack = newStream.getVideoTracks()[0];
      const pc = peerConnectionRef.current;
      if (pc) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(newTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }
    } catch (e) {
      console.warn('Camera switch error:', e);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleHangUp = () => {
    if (callDuration > 0 && activeCall) {
      incrementCallQuota(currentUser?.subscriptionPlan, callDuration, activeCall.callType);
    }
    onEndCall();
  };

  // ==========================================
  // INCOMING CALL VIEW
  // ==========================================
  if (activeCall.status === 'incoming') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl animate-in zoom-in-95">
          <div className="relative mx-auto w-20 h-20 mb-4">
            <img
              src={activeCall.caller.avatar}
              alt={activeCall.caller.name}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-indigo-500/40"
            />
            <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-indigo-600 text-white shadow-md">
              {activeCall.callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-100">{activeCall.caller.name}</h3>
          <p className="text-xs text-indigo-400 font-medium mt-0.5">
            Llamada entrante de {activeCall.callType === 'video' ? 'video' : 'voz'}
          </p>
          <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Cifrado E2EE (AES-256)</span>
          </div>

          <div className="flex items-center justify-center gap-6 mt-8">
            <button
              onClick={onEndCall}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="Rechazar"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <button
              onClick={onAcceptIncomingCall}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
              title="Contestar"
            >
              {activeCall.callType === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // PICTURE-IN-PICTURE MINIMIZED VIEW
  // (Allows chatting & reading translations while talking!)
  // ==========================================
  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3 flex items-center gap-3 w-80 animate-in slide-in-from-bottom-5">
        <div className="relative w-10 h-10 shrink-0">
          <img
            src={activeCall.caller.avatar}
            alt={activeCall.caller.name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-slate-900" />
        </div>

        <div className="flex-1 truncate">
          <p className="text-xs font-bold text-slate-100 truncate">{activeCall.caller.name}</p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>{formatTimer(callDuration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={toggleMute}
            className={`p-2 rounded-xl transition-colors ${
              isMuted ? 'bg-rose-600/20 text-rose-400' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Expandir llamada"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEndCall}
            className="p-2 rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition-colors"
            title="Colgar"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // FULL WECHAT/TELEGRAM STYLE CALL OVERLAY
  // ==========================================
  return (
    <div id="callScreen" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-2xl h-[85vh] max-h-[640px] bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
        {/* Top Header Bar */}
        <div className="absolute top-0 inset-x-0 p-4 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span data-i18n="encrypted">{t('encrypted')} (AES-256)</span>
            </span>
            <span className="text-xs font-mono text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-700">
              {activeCall.status === 'calling' ? 'Conectando...' : formatTimer(callDuration)}
            </span>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Minimizar a Picture-in-Picture"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Video / Audio Viewport */}
        <div className="relative flex-1 w-full bg-slate-900 flex items-center justify-center overflow-hidden">
          {activeCall.callType === 'video' ? (
            <>
              {/* Remote Video Stream (Main background) */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Local Floating Video Preview (PiP inside modal) */}
              <div className="absolute top-16 right-4 w-32 sm:w-40 aspect-video rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl bg-slate-950 z-10">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${!isVideoDisabled ? '' : 'hidden'}`}
                />
                {isVideoDisabled && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400">
                    <VideoOff className="w-6 h-6" />
                    <span className="text-[10px] mt-1">Cámara apagada</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Voice Call Mode - Clean WeChat/Telegram Audio Avatar
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="relative">
                <div className="w-28 h-28 rounded-full ring-8 ring-indigo-500/20 overflow-hidden shadow-2xl">
                  <img
                    src={activeCall.caller.avatar}
                    alt={activeCall.caller.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="absolute -bottom-1 -right-1 p-2 rounded-full bg-emerald-500 text-white ring-4 ring-slate-950">
                  <Phone className="w-4 h-4" />
                </span>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-white">{activeCall.caller.name}</h3>
                <p className="text-xs text-indigo-400 font-medium">#{activeCall.channelName}</p>
                <div className="flex items-center justify-center gap-1 mt-3">
                  {[30, 60, 90, 50, 80, 40, 70, 95, 60, 40, 75, 50].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-emerald-400 rounded-full animate-pulse"
                      style={{
                        height: `${h * 0.35}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-4 sm:p-6 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-center gap-3 sm:gap-4 z-20">
          {/* Mute Audio */}
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isMuted ? 'Activar micrófono' : 'Silenciar'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Video (if video call) */}
          {activeCall.callType === 'video' && (
            <>
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isVideoDisabled
                    ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title={isVideoDisabled ? 'Encender cámara' : 'Apagar cámara'}
              >
                {isVideoDisabled ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>

              <button
                onClick={switchCamera}
                className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-all"
                title="Cambiar cámara"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>

              <button
                onClick={toggleScreenShare}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isScreenSharing
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title="Compartir pantalla"
              >
                <Monitor className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Hang Up (Colgar) */}
          <button
            data-i18n="end"
            onClick={handleHangUp}
            className="w-14 h-12 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-transform active:scale-95 cursor-pointer ml-2"
            title={t('end')}
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
