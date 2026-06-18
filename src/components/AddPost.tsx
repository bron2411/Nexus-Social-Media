import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Film, Send, X, AlertCircle } from 'lucide-react';
import { useNexusStore } from '../store';
import { createPost } from '../services/firebaseService';

export function AddPost() {
  const { user } = useNexusStore();
  const [content, setContent] = useState('');
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleSelectFileClick = (type: 'image' | 'video') => {
    if (fileInputRef.current) {
      if (type === 'image') {
        fileInputRef.current.accept = 'image/*';
      } else {
        fileInputRef.current.accept = 'video/*';
      }
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size to prevent Firestore Document size exhaustion (max 1MB payload ideally for base64)
    if (file.size > 900 * 1024) {
      setErrorMessage('El archivo excede el tamaño máximo permitido (Máximo 900kb).');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMediaData(reader.result);
        setMediaType(type);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Error al leer el archivo local.');
    };
    reader.readAsDataURL(file);
  };

  const handleCancelMedia = () => {
    setMediaData(null);
    setMediaType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;
    
    setLoading(true);
    try {
      await createPost(content, mediaData || undefined, mediaType || undefined);
      setContent('');
      handleCancelMedia();
    } catch (error) {
      console.error(error);
      setErrorMessage('No se pudo subir la publicación, reintente.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border-b border-white/5 flex gap-3 bg-zinc-950/30">
      <img 
        src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=guest`} 
        alt="Avatar" 
        className="h-10 w-10 rounded-full border border-white/10 shrink-0 object-cover bg-zinc-900"
        referrerPolicy="no-referrer"
      />
      <div className="flex-1">
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="¿Qué estás pensando hoy?"
          className="w-full bg-transparent border-none focus:ring-0 text-white placeholder:text-zinc-600 resize-none pt-2 text-sm outline-none"
          rows={2}
          disabled={loading}
        />

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Media Preview inside the form */}
        {mediaData && (
          <div className="relative mt-2 mb-3 rounded-xl overflow-hidden border border-white/10 max-h-60 bg-zinc-950 flex items-center justify-center">
            {mediaType === 'image' ? (
              <img 
                src={mediaData} 
                alt="Upload preview" 
                className="max-h-60 max-w-full object-contain"
              />
            ) : (
              <video 
                src={mediaData} 
                autoPlay
                muted
                loop
                playsInline
                className="max-h-60 max-w-full object-contain"
              />
            )}
            <button 
              onClick={handleCancelMedia}
              className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black text-white rounded-full transition cursor-pointer"
              title="Cancelar selección"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1 font-mono">
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
          <div className="flex gap-4 text-zinc-500">
            <button 
              type="button"
              onClick={() => handleSelectFileClick('image')}
              className="hover:text-blue-500 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono font-bold"
              title="Añadir Imagen"
              disabled={loading}
            >
              <ImageIcon size={18} />
              <span className="hidden sm:inline">Imagen</span>
            </button>
            <button 
              type="button"
              onClick={() => handleSelectFileClick('video')}
              className="hover:text-blue-500 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono font-bold"
              title="Añadir Video"
              disabled={loading}
            >
              <Film size={18} />
              <span className="hidden sm:inline">Video</span>
            </button>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-mono uppercase tracking-wider px-4 py-1.5 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {loading ? 'Subiendo...' : 'Publicar'}
            <Send size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
