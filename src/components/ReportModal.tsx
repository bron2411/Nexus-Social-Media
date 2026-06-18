import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X, Shield, Send } from 'lucide-react';
import { reportContent } from '../services/firebaseService';
import { auth } from '../firebase';

interface ReportModalProps {
  targetId: string;
  targetType: 'post' | 'user' | 'comment';
  isOpen: boolean;
  onClose: () => void;
}

export function ReportModal({ targetId, targetType, isOpen, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const REASONS = [
    'Spam or misleading',
    'Abusive or harmful content',
    'Self-harm or violence',
    'Intellectual property violation',
    'Other'
  ];

  const handleSubmit = async () => {
    if (!reason || !auth.currentUser) return;
    setIsSubmitting(true);
    try {
      await reportContent(targetId, targetType, reason, details);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10"
          >
            {submitted ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
                  <Shield size={32} />
                </div>
                <h3 className="text-xl font-bold text-white">Reporte recibido</h3>
                <p className="text-zinc-500 text-xs font-sans leading-relaxed">
                  Análisis de reporte iniciado. Gracias por ayudarnos a mantener una comunidad segura.
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={20} className="text-red-500" />
                    <span className="font-bold text-sm tracking-tight">Reportar {targetType === 'post' ? 'Publicación' : 'Mensaje'}</span>
                  </div>
                  <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Select violation type</p>
                    <div className="grid grid-cols-1 gap-2">
                      {REASONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setReason(r)}
                          className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                            reason === r 
                              ? "bg-blue-600/10 border-blue-500/50 text-white" 
                              : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                   {reason && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Detalles del reporte (Opcional)</p>
                      <textarea 
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        placeholder="Proporciona más detalles sobre el reporte..."
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-sm text-zinc-300 outline-none focus:border-blue-500/50 transition-all min-h-[80px]"
                      />
                    </div>
                  )}

                  <button 
                    disabled={!reason || isSubmitting}
                    onClick={handleSubmit}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:scale-100 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                  >
                    {isSubmitting ? "Enviando reporte..." : "Enviar Reporte"}
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
