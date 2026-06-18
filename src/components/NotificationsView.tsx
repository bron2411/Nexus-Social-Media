import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  Heart, 
  MessageSquare, 
  UserPlus, 
  Zap, 
  CheckCheck, 
  Trash2, 
  ShieldCheck, 
  Terminal, 
  Sparkles,
  Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../firebase';
import { 
  subscribeToUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  requestNotificationPermission, 
  createRealtimeNotification,
  isPushSupported
} from '../services/notificationService';
import { useNexusStore } from '../store';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '../firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export function NotificationsView() {
  const { setActiveView, setActiveChatId, user: currentUser } = useNexusStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Registration and Settings states
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [fcmToken, setFcmToken] = useState<string>('');
  const [registrationMode, setRegistrationMode] = useState<'real' | 'virtual'>('real');
  const [regFeedback, setRegFeedback] = useState<{ type: 'success' | 'error' | 'info' | null; message: string }>({ type: null, message: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Real-time subscribe to Firestore notifications via reactive user
  useEffect(() => {
    if (!currentUser?.uid || !auth.currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToUserNotifications(currentUser.uid, (data) => {
      setNotifications(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const handleRegisterPush = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsRegistering(true);
    setRegFeedback({ type: null, message: '' });

    try {
      const res = await requestNotificationPermission(currentUser.uid);
      if (res.success) {
        setFcmToken(res.token || '');
        if (typeof window !== 'undefined' && 'Notification' in window) {
          setPermissionStatus(Notification.permission);
        }
        if (res.isVirtual) {
          setRegistrationMode('virtual');
          setRegFeedback({
            type: 'info',
            message: res.warning || 'Entorno sandbox detectado. Canal virtual de mensajería activado.'
          });
        } else {
          setRegistrationMode('real');
          setRegFeedback({
            type: 'success',
            message: '¡Notificaciones push vinculadas con éxito a este dispositivo!'
          });
        }
      } else {
        setRegFeedback({
          type: 'error',
          message: res.error || 'No se pudo vincular las notificaciones.'
        });
      }
    } catch (err: any) {
      setRegFeedback({
        type: 'error',
        message: err.message || 'Error durante el registro.'
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (notifications.length === 0) return;
    await markAllNotificationsAsRead(notifications);
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    await markNotificationAsRead(notif.id);
    
    if (notif.type === 'message' && notif.chatId) {
      setActiveChatId(notif.chatId);
      setActiveView('messages');
    } else {
      // General feedback view redirects
      setActiveView('feed');
    }
  };

  // Simulation handlers to self-test
  const handleSimulateAlert = async (type: 'like' | 'comment' | 'mention' | 'message') => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    let contentOrTitle = '';
    let postId = 'simulated_post';
    let chatId = 'simulated_chat';

    switch (type) {
      case 'like':
        contentOrTitle = 'le dio me gusta a tu publicación sobre Microservicios';
        break;
      case 'comment':
        contentOrTitle = 'comentó: "Me parece excelente tu publicación"';
        break;
      case 'mention':
        contentOrTitle = 'te mencionó en una publicación';
        break;
      case 'message':
        contentOrTitle = '¡Hola! ¿Cómo estás hoy?';
        chatId = 'global-nexus-chat';
        break;
    }

    await createRealtimeNotification({
      recipientId: currentUser.uid,
      type,
      contentOrTitle,
      postId,
      chatId
    });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="flex-1 min-h-screen bg-zinc-950 font-sans text-zinc-300">
      {/* Header */}
      <header className="h-16 border-b border-white/5 px-6 flex items-center justify-between sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Bell className="text-blue-500 animate-pulse" size={20} />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wider uppercase font-mono">Bandeja de Alertas</h2>
            <p className="text-[10px] text-zinc-500 font-mono">Real-time FCM Notifications Buffer</p>
          </div>
        </div>
        
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition-all"
          >
            <CheckCheck size={14} />
            Marcar todo leído ({unreadCount})
          </button>
        )}
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        
        {/* Real-time Push control Gateway center */}
        <section className="bg-gradient-to-br from-zinc-900/50 to-zinc-950 border border-white/5 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Terminal size={140} className="text-blue-500" />
          </div>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <ShieldCheck size={24} />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">Módulo de Notificaciones Push Real-time</h3>
              <p className="text-xs text-zinc-400 leading-normal">
                Esta aplicación utiliza notificaciones push. Al autorizar el acceso, habilitarás que este dispositivo reciba de forma segura alertas de tus mensajes y actividades al instante.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-500">Estado de Permisos:</span>
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${
                  permissionStatus === 'granted' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : permissionStatus === 'denied'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {permissionStatus === 'granted' ? 'Habilitado' : permissionStatus === 'denied' ? 'Denegado' : 'No Solicitado'}
                </span>
                {registrationMode === 'virtual' && fcmToken && (
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Modo Virtual / Sandbox
                  </span>
                )}
              </div>
              
              {fcmToken && (
                <div className="flex items-center gap-2 max-w-md">
                  <span className="text-[10px] font-mono text-zinc-500">Token ID:</span>
                  <input 
                    type="text" 
                    readOnly 
                    value={fcmToken} 
                    className="bg-zinc-950 font-mono text-[9px] text-zinc-400 border border-white/5 px-2 py-1 rounded w-full select-all outline-none"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleRegisterPush}
              disabled={isRegistering}
              className={`font-mono text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer transition-all flex items-center gap-2 shrink-0 ${
                permissionStatus === 'granted' && fcmToken
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 animate-pulse'
              }`}
            >
              <Bell size={14} />
              {isRegistering ? 'Sincronizando...' : permissionStatus === 'granted' && fcmToken ? '✓ Notificaciones Pusheadas' : 'Vincular Dispositivo (Push)'}
            </button>
          </div>

          {/* Feedback logs */}
          <AnimatePresence>
            {regFeedback.message && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className={`mt-4 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs leading-relaxed ${
                  regFeedback.type === 'error' 
                    ? 'bg-red-500/5 border-red-500/10 text-red-400' 
                    : regFeedback.type === 'info'
                    ? 'bg-blue-500/5 border-blue-500/10 text-blue-300'
                    : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400'
                }`}
              >
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{regFeedback.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Real-time user Simulator interface */}
        <section className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <Sparkles className="text-blue-400" size={16} />
            <span className="font-mono text-[11px] font-bold tracking-widest uppercase text-blue-400">Panel de Pruebas de Notificaciones (Simulador)</span>
          </div>
          <p className="text-xs text-zinc-400 mb-5 leading-normal">
            ¡Envía una alerta simulada directo a tu dispositivo! Al presionar cualquier botón, se inyectará una notificación real en Firestore, gatillando alertas visuales instantáneas del sistema en tu interfaz activa.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button 
              onClick={() => handleSimulateAlert('like')}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[11px] py-2.5 px-3 rounded-xl border border-white/5 hover:border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Heart size={12} className="text-red-500" />
              Simular Me gusta
            </button>
            <button 
              onClick={() => handleSimulateAlert('comment')}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[11px] py-2.5 px-3 rounded-xl border border-white/5 hover:border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <MessageSquare size={12} className="text-blue-500" />
              Simular Comentario
            </button>
            <button 
              onClick={() => handleSimulateAlert('mention')}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[11px] py-2.5 px-3 rounded-xl border border-white/5 hover:border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Zap size={12} className="text-yellow-500" />
              Simular Mención
            </button>
            <button 
              onClick={() => handleSimulateAlert('message')}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-[11px] py-2.5 px-3 rounded-xl border border-white/5 hover:border-white/10 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <MessageSquare size={12} className="text-green-500" />
              Simular Mensaje MD
            </button>
          </div>
        </section>

        {/* Real Dynamic Notifications List Render */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-2 uppercase font-mono tracking-wider">
              Historial de Notificaciones
              {unreadCount > 0 && (
                <span className="w-5 h-5 flex items-center justify-center text-[10px] font-sans font-bold bg-blue-600 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h4>
          </div>

          <div className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
            {loading ? (
              <div className="p-12 text-center text-zinc-500 text-xs font-mono">
                Cargando búfer de notificaciones...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-16 text-center text-zinc-500 space-y-2">
                <Bell className="mx-auto text-zinc-700 mb-3" size={32} />
                <p className="text-xs font-mono uppercase tracking-widest text-zinc-500">Búfer Vacío // Sin Alertas Recientes</p>
                <p className="text-[11px] text-zinc-600">Cuando recibas me gustas, menciones o mensajes directos, aparecerán aquí.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {notifications.map((notif) => (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 hover:bg-white/[0.02] cursor-pointer transition-all flex gap-4 items-start group relative ${
                      !notif.isRead ? 'bg-blue-500/[0.02]' : ''
                    }`}
                  >
                    {/* Unread marker bar */}
                    {!notif.isRead && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                    )}

                    <img 
                      src={notif.senderPhoto} 
                      alt={notif.senderName} 
                      className="w-10 h-10 rounded-full border border-white/10 object-cover shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-white tracking-tight">@{notif.senderName}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {notif.createdAt ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: false, locale: es }) : ''}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="shrink-0">
                          {notif.type === 'like' && <Heart size={14} className="text-red-500" />}
                          {notif.type === 'comment' && <MessageSquare size={14} className="text-blue-500" />}
                          {notif.type === 'mention' && <Zap size={14} className="text-yellow-500" />}
                          {notif.type === 'message' && <MessageSquare size={14} className="text-green-500" />}
                        </div>
                        <p className="text-sm text-zinc-300 truncate leading-relaxed">{notif.contentOrTitle}</p>
                      </div>
                    </div>

                    <button 
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      className="text-zinc-500 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-white/5"
                      title="Eliminar notificación"
                    >
                      <Trash2 size={13} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
