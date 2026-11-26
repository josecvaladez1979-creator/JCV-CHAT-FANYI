import React, { useRef, useState } from 'react';
import { X, Camera, Trash2, Loader2, Check } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUpdated: (user: User) => void;
}

const SIZE = 256; // píxeles por lado
const TARGET_BYTES = 50 * 1024; // objetivo de peso (el servidor acepta hasta 80 KB)
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo abrir esa imagen. Prueba con una foto JPG o PNG.'));
    img.src = src;
  });
}

// Recorta la foto al centro en cuadrado, la reduce a 256 px y la guarda como JPEG.
// Al volver a dibujarla se pierden los datos ocultos de la foto original
// (ubicación, modelo de cámara, fecha).
async function toAvatarJpeg(file: File): Promise<string> {
  const img = await loadImage(await readAsDataUrl(file));

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no pudo preparar la foto.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);

  // Se baja la calidad hasta que pese poco.
  let dataUrl = '';
  for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    const bytes = Math.floor(((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3) / 4);
    if (bytes <= TARGET_BYTES) break;
  }
  return dataUrl;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, currentUser, onUpdated }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!isOpen || !currentUser) return null;

  const shown = preview || currentUser.avatar || '';
  const initial = currentUser.name.trim().charAt(0).toUpperCase() || '?';

  const handleClose = () => {
    setPreview(null);
    setError(null);
    setDone(null);
    onClose();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite elegir la misma foto otra vez
    if (!file) return;

    setError(null);
    setDone(null);

    if (!file.type.startsWith('image/')) {
      setError('Elige una imagen (JPG, PNG o WebP).');
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError('Esa foto es muy grande. Elige una de menos de 15 MB.');
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await toAvatarJpeg(file);
      setPreview(dataUrl);
      const user = await api.uploadAvatar(dataUrl);
      onUpdated(user);
      setDone('Tu foto se actualizó.');
    } catch (err: any) {
      setPreview(null);
      setError(err.message || 'No se pudo guardar la foto.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const user = await api.removeAvatar();
      setPreview(null);
      onUpdated(user);
      setDone('Quitaste tu foto.');
    } catch (err: any) {
      setError(err.message || 'No se pudo quitar la foto.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-slate-100">Mi foto de perfil</h3>
        <p className="text-xs text-slate-400 mt-1">
          La verán las personas de tus canales, junto a tus mensajes.
        </p>

        <div className="flex flex-col items-center gap-4 mt-6">
          {shown ? (
            <img
              src={shown}
              alt={currentUser.name}
              className="w-32 h-32 rounded-full object-cover ring-4 ring-indigo-500/30"
            />
          ) : (
            <span className="w-32 h-32 rounded-full bg-indigo-700 text-white text-5xl font-bold flex items-center justify-center ring-4 ring-indigo-500/30">
              {initial}
            </span>
          )}

          <div className="text-center">
            <div className="text-sm font-semibold text-slate-100">{currentUser.name}</div>
            <div className="text-[11px] text-slate-400">{currentUser.email}</div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <span>{currentUser.avatar ? 'Cambiar foto' : 'Subir foto'}</span>
            </button>

            {currentUser.avatar && (
              <button
                type="button"
                disabled={busy}
                onClick={handleRemove}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Quitar</span>
              </button>
            )}
          </div>

          {error && (
            <div role="alert" className="w-full p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}
          {done && (
            <div role="status" className="w-full p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{done}</span>
            </div>
          )}

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Se recorta en cuadrado y se reduce en tu teléfono antes de subirla, y se borra la
            ubicación y los datos escondidos de la foto. Quien conozca la dirección de tu foto
            puede verla.
          </p>
        </div>
      </div>
    </div>
  );
};
