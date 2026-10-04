export function getLang(): string;
export function t(key: string): string;
export const setLang: (lang: string) => void;
export function connectToRoom(stream: MediaStream, isVideo: boolean): void;
export function updateI18nElements(): void;
export const translations: Record<string, Record<string, string>>;
export let localStream: MediaStream | null;

declare global {
  interface Window {
    t: (key: string) => string;
    setLang: (lang: string) => void;
    startCall: (isVideo: boolean) => Promise<void>;
    endCall: () => void;
    connectToRoom: (stream: MediaStream, isVideo: boolean) => void;
    onJcvConnectToRoom?: (stream: MediaStream, isVideo: boolean) => void;
    onJcvEndCall?: () => void;
    localStream?: MediaStream | null;
  }
}
