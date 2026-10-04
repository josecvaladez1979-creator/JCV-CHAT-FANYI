import { LanguageCode } from '../types';

/**
 * Text-to-speech using browser Web Speech API with language selection
 */
export function speakText(text: string, langCode: LanguageCode, rate = 1.0): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported in this browser.'));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;

    const langMap: Record<LanguageCode, string> = {
      es: 'es-ES',
      en: 'en-US',
      zh: 'zh-CN',
      ja: 'ja-JP',
      fr: 'fr-FR',
      de: 'de-DE',
      pt: 'pt-BR',
      it: 'it-IT',
      ru: 'ru-RU',
      ko: 'ko-KR',
      ar: 'ar-SA',
      hi: 'hi-IN',
    };

    utterance.lang = langMap[langCode] || 'es-ES';

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find((v) => v.lang.startsWith(utterance.lang.slice(0, 2)));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.warn('Speech synthesis notice:', e);
      resolve(); // Do not block if speech interrupted
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Synthesizes a subtle notification chime using Web Audio API
 */
export function playNotificationSound(type: 'send' | 'receive' | 'lock') {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'send') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'receive') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Lock sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(450, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (err) {
    // Audio context may be restricted before user gesture
  }
}

/**
 * Voice recorder with live waveform analyser
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  async start(onWaveformData?: (data: number[]) => void): Promise<void> {
    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();

    if (onWaveformData) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);
        const normalized = Array.from(dataArray.slice(0, 16)).map((v) => v / 255);
        onWaveformData(normalized);
        this.animationFrameId = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();
    }
  }

  stop(): Promise<{ blob: Blob; base64: string; duration: number }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.audioContext) {
        this.audioContext.close();
      }

      if (!this.mediaRecorder) {
        resolve({ blob: new Blob(), base64: '', duration: 0 });
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string) || '';
          const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          // Clean up stream tracks
          this.stream?.getTracks().forEach((track) => track.stop());
          resolve({ blob: audioBlob, base64, duration });
        };
        reader.readAsDataURL(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }
}
