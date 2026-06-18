import React, { useState } from 'react';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  signInWithCustomToken,
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { X, LogIn, Mail, Lock, User as UserIcon, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'google' | 'email'>('email');
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setRegisterSuccess(false);
    setErrorMsg('');
    setLoading(false);
    onClose();
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      handleClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setErrorMsg('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes o usa el acceso local.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMsg('El inicio de sesión con Google no está habilitado o configurado en tu consola Firebase.');
      } else {
        setErrorMsg('Error de conexión con Google. Si usas IP local, Google no lo permite; por favor, usa "Acceso Local" abajo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Llama a nuestra API personalizada para registro con verificación
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, displayName })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Error al registrar.');
        }

        // Mostrar pantalla de éxito
        setRegisterSuccess(true);
      } else {
        // Sign In
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Verifica que el correo haya sido validado a través de nuestro enlace,
        // esto se marca como 'emailVerified: true' en nuestro endpoint /verify/:token
        if (!userCredential.user.emailVerified) {
             // Es importante cerrar la sesión recién iniciada si no está verificado
             await auth.signOut();
             setErrorMsg("Debes verificar tu correo antes de iniciar sesión. Por favor, revisa tu bandeja de entrada o la carpeta de SPAM.");
             setLoading(false);
             return;
        }

        handleClose();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setErrorMsg('Credenciales inválidas. Verifica tu correo y contraseña.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMsg('Demasiados intentos. Intenta más tarde.');
      } else {
        setErrorMsg(`Error: ${err.message || 'Error al autenticar'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, 'demo_general@nexus.chat', 'nexus123');
      handleClose();
    } catch (err: any) {
      console.error("Fallo creación demo rápido:", err);
      setErrorMsg('No se pudo iniciar sesión. Asegúrate de tener configurado demo_general@nexus.chat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Blurred overlay background */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={registerSuccess ? undefined : handleClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
      />

      {/* Modal card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className="relative w-full max-w-md bg-[#0D0D10] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10 flex flex-col"
      >
        {/* Header decoration */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600" />

        {/* Close Button */}
        {!registerSuccess && (
          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
          >
            <X size={16} />
          </button>
        )}

        <div className="p-6 flex flex-col gap-5">
          {registerSuccess ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-6">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Revisa tu correo</h2>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Hemos enviado un enlace de activación a <strong className="text-white">{email}</strong>. Por favor, haz clic en el enlace para validar tu cuenta e ingresar.
              </p>
              <button 
                onClick={handleClose}
                className="w-full bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl hover:bg-zinc-700 active:scale-98 transition-all text-sm mt-4"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {/* Accent decoration */}
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-blue-500/20 text-blue-400 rounded-md flex items-center justify-center">
                  <Sparkles size={12} className="animate-pulse" />
                </div>
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase font-black">Acceso a Nexus</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">Iniciar Sesión</h2>
                <p className="text-xs text-zinc-400">
                  Conéctate para publicar posts, dar likes, retuitear y enviar mensajes directos.
                </p>
              </div>

              {/* Selector de pestañas */}
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => { setActiveTab('email'); setErrorMsg(''); }}
                  className={`flex-1 py-1.5 text-center text-xs font-mono font-bold rounded-lg transition-all ${
                    activeTab === 'email' 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Contraseña
                </button>
                <button
                  onClick={() => { setActiveTab('google'); setErrorMsg(''); }}
                  className={`flex-1 py-1.5 text-center text-xs font-mono font-bold rounded-lg transition-all ${
                    activeTab === 'google' 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Google
                </button>
              </div>

              {/* Feedback de error */}
              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex gap-2.5 items-start text-red-400 text-xs font-medium leading-relaxed animate-shake">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Tab 1: Google Connection */}
              {activeTab === 'google' && (
                <div className="space-y-4 py-2">
                  <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-900/40 p-3 rounded-xl border border-white/5">
                    <p className="font-bold text-zinc-300 mb-1">💡 Información Importante:</p>
                    Google Auth requiere que la aplicación se cargue en un entorno seguro (localhost o HTTPS). 
                    Si accedes desde otro dispositivo o con la IP local de tu ordenador, haz clic en la pestaña 
                    <strong className="text-blue-400"> "Contraseña" </strong> para iniciar sesión sin problemas.
                  </div>

                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white text-zinc-900 font-bold py-3 px-4 rounded-xl hover:bg-zinc-200 active:scale-98 transition-all text-sm disabled:opacity-50"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.107C18.23 1.92 15.44 1 12.24 1 6.21 1 1.25 5.925 1.25 12s4.96 11 10.99 11c6.29 0 10.48-4.414 10.48-10.655 0-.718-.075-1.27-.17-1.76H12.24z"/>
                    </svg>
                    {loading ? 'Conectando...' : 'Continuar con Google'}
                  </button>
                </div>
              )}

              {/* Tab 2: Classic Email Auth */}
              {activeTab === 'email' && (
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Nombre de Mostrar</label>
                      <div className="relative">
                        <UserIcon className="absolute left-3.5 top-3 text-zinc-500" size={16} />
                        <input 
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Ej. Juan Pérez"
                          className="w-full bg-[#121215] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Email o Nombre de Usuario</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 text-zinc-500" size={16} />
                      <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="correo@ejemplo.com"
                        className="w-full bg-[#121215] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors focus:ring-0"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 text-zinc-500" size={16} />
                      <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-[#121215] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors focus:ring-0"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-2.5">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 text-white font-bold py-2.5 px-4 rounded-xl hover:bg-blue-500 active:scale-98 transition-all text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <LogIn size={14} />
                      {loading ? 'Espere...' : isSignUp ? 'Crear Cuenta local' : 'Iniciar Sesión local'}
                    </button>

                    {/* Quick Toggle Register / Login */}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-xs text-center text-zinc-500 hover:text-zinc-300 font-mono transition-colors"
                    >
                      {isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate aquí'}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center my-1">
                      <hr className="flex-1 border-white/5" />
                      <span className="px-3 text-[9px] font-mono text-zinc-600 uppercase tracking-widest">O</span>
                      <hr className="flex-1 border-white/5" />
                    </div>

                    {/* 1-Click Fast Trial Button */}
                    <button
                      type="button"
                      onClick={handleQuickDemo}
                      disabled={loading}
                      className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 font-bold py-2.5 px-4 rounded-xl active:scale-98 transition-all text-xs flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} className="text-indigo-400" />
                      Acceso Rápido de Prueba (1-Clic)
                    </button>
                    <p className="text-[10px] text-zinc-500 text-center leading-normal font-mono px-2">
                      Prueba la app en tu móvil al instante y conéctate como miembro de prueba.
                    </p>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
