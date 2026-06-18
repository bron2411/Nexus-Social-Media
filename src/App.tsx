import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Feed } from './components/Feed';
import { ChatWindow } from './components/ChatWindow';
import { useNexusStore } from './store';
import { Search, TrendingUp, Mail, LogIn, AlertTriangle, Settings, Home, Bell, User as UserIcon } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { subscribeToPosts, testFirestoreConnection, saveUser, setOnlineStatus, subscribeToChats } from './services/firebaseService';
import { SearchOverlay } from './components/SearchOverlay';
import { AdminPanel } from './components/AdminPanel';
import { NotificationsView } from './components/NotificationsView';
import { MessagesView } from './components/MessagesView';
import { ProfileView } from './components/ProfileView';
import { PublicProfileView } from './components/PublicProfileView';
import { NotificationSettings } from './components/NotificationSettings';
import { AuthModal } from './components/AuthModal';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from './firebase';
import { Post, User } from './types';
import { cn } from './lib/utils';
import { 
  registerNotificationServiceWorker, 
  subscribeToUserNotifications, 
  markNotificationAsRead,
  onForegroundMessageReceived 
} from './services/notificationService';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const { 
    posts, 
    setPosts, 
    user, 
    setUser, 
    toggleChat, 
    setActiveChatId, 
    activeView, 
    setActiveView, 
    setSearchQuery,
    isAuthModalOpen,
    setAuthModalOpen
  } = useNexusStore();
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Real-time notification list and toast alerts
  const [notifications, setNotifications] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [activeToast, setActiveToast] = useState<{
    id: string;
    senderName: string;
    senderPhoto: string;
    type: string;
    contentOrTitle: string;
    chatId?: string;
  } | null>(null);


  // Register background service worker when app mounts
  useEffect(() => {
    registerNotificationServiceWorker();
    
    // Foreground FCM list push message receiver
    const unsubscribeForeground = onForegroundMessageReceived((payload) => {
      console.log('[FCM] Received foreground payload:', payload);
      if (payload?.notification) {
        setActiveToast({
          id: `fcm_${Date.now()}`,
          senderName: payload.notification.title || 'Nexus Cloud',
          senderPhoto: `https://api.dicebear.com/7.x/avataaars/svg?seed=fcm`,
          type: 'mention',
          contentOrTitle: payload.notification.body || ''
        });
      }
    });

    return () => {
      unsubscribeForeground();
    };
  }, []);

  // Dismiss transient toast after 4.5 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  useEffect(() => {
    let unsubscribeUser: () => void = () => {};
    let unsubscribePosts: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Run connection check only when authenticated to prevent permission-denied errors
        testFirestoreConnection();

        // Asegurar que el usuario existe en Firestore
        saveUser(firebaseUser);
        
        // Map uid and id to be fully safe with downstream components
        unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (snapshot) => {
          if (snapshot.exists()) {
            setUser({ id: snapshot.id, uid: snapshot.id, ...snapshot.data() } as any);
          } else {
            // Si el documento no existe aún, establecer datos básicos
            setUser({
              uid: firebaseUser.uid,
              username: firebaseUser.displayName?.toLowerCase().replace(/\s/g, '') || 'nexus_user',
              displayName: firebaseUser.displayName || 'Nexus User',
              photoURL: firebaseUser.photoURL || undefined,
              followersCount: 0,
              followingCount: 0,
              createdAt: new Date().toISOString(),
              isAdmin: false,
              isBanned: false
            } as any);
          }
          setLoading(false);
        }, (error) => {
            console.error("User snapshot error:", error);
            setLoading(false);
        });

      } else {
        unsubscribeUser();
        setUser(null);
        setActiveView('feed');
        setLoading(false);
      }
    });

    // Suscribirse a posts independientemente de si hay sesión iniciada
    unsubscribePosts = subscribeToPosts((newPosts) => {
      setPosts(newPosts);
    });

    const unsubscribeUsersMap = onSnapshot(collection(db, 'users'), (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.forEach(doc => {
        map[doc.id] = doc.data();
      });
      useNexusStore.getState().setUsersMap(map);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUser();
      unsubscribePosts();
      unsubscribeUsersMap();
    };
  }, []);

  // Synchronize authenticated subscriptions
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setChats([]);
      return;
    }

    const unsubscribeChats = subscribeToChats((updatedChats) => {
      setChats(updatedChats);
    });

    let isFirstFetch = true;
    const unsubscribeNotifications = subscribeToUserNotifications(user.uid, (list) => {
      setNotifications(list);
      
      if (isFirstFetch) {
        isFirstFetch = false;
        return; // Avoid flashing old items on app initialize
      }

      // Trigger screen pop toast for the latest unread item only
      const latestUnread = list.find(n => !n.isRead);
      if (latestUnread) {
        setActiveToast({
          id: latestUnread.id,
          senderName: latestUnread.senderName,
          senderPhoto: latestUnread.senderPhoto,
          type: latestUnread.type,
          contentOrTitle: latestUnread.contentOrTitle,
          chatId: latestUnread.chatId || undefined
        });
      }
    });

    return () => {
      unsubscribeChats();
      unsubscribeNotifications();
    };
  }, [user?.uid]);

  // Online/Offline presence synchronization with real-time heartbeat
  useEffect(() => {
    if (!user?.uid) return;

    // Report online initially
    setOnlineStatus(user.uid, true);

    // Setup periodic heartbeat every 60 seconds to keep lastSeen updated in real-time
    const heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setOnlineStatus(user.uid, true);
      }
    }, 60000);

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setOnlineStatus(user.uid, isVisible);
    };

    const handleBeforeUnload = () => {
      setOnlineStatus(user.uid, false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOnlineStatus(user.uid, false);
    };
  }, [user?.uid]);

  const handleLogin = () => {
    setAuthModalOpen(true);
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent animate-pulse">Cargando...</h1>
      </div>
    );
  }

  if (user?.isBanned) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6">
        <div className="max-w-md w-full glass p-8 rounded-2xl border-red-500/20 text-center space-y-6">
          <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto text-red-500">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Cuenta suspendida</h1>
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">Acceso Restringido</p>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Tu cuenta ha sido temporal o permanentemente suspendida por infringir las pautas comunitarias de la plataforma.
          </p>
          <button onClick={() => auth.signOut()} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 transition-colors">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-200 selection:bg-blue-500/30 font-sans overflow-x-hidden w-full">
      <div className="mx-auto max-w-[1440px] flex min-h-screen relative overflow-x-hidden">
        <Sidebar 
          onSearchOpen={() => setIsSearchOpen(true)} 
          onAdminClick={() => setActiveView('admin')}
          activeView={activeView}
          onViewChange={(v: any) => setActiveView(v)}
          unreadNotificationsCount={notifications.filter(n => !n.isRead).length}
        />
        
        {/* Main Content Area */}
        <div className="flex-1 ml-0 lg:ml-64 flex min-w-0">
          <div className="flex-1 border-r border-white/5 flex flex-col min-w-0">
            {!user && ['notifications', 'messages', 'profile', 'admin'].includes(activeView) ? (
              <div className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0B] text-center min-h-screen">
                <div className="max-w-md w-full glass p-8 rounded-2xl border border-white/5 space-y-6">
                  <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
                    <UserIcon size={32} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">Regístrate o Conéctate</h2>
                    <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">Contenido Restringido para Invitados</p>
                  </div>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Estás navegando en modo invitado. Puedes ver todo el contenido público y posts creados por otros miembros, pero necesitas conectarte para poder ver tus notificaciones, enviar mensajes privados o editar tu perfil.
                  </p>
                  <button 
                    onClick={() => setAuthModalOpen(true)} 
                    className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-500 transition-colors cursor-pointer active:scale-98 text-sm"
                  >
                    Conéctate ahora
                  </button>
                </div>
              </div>
            ) : activeView === 'feed' ? (
              <Feed posts={posts} />
            ) : activeView === 'admin' ? (
              <AdminPanel />
            ) : activeView === 'notifications' ? (
              <NotificationsView />
            ) : activeView === 'messages' ? (
              <MessagesView />
            ) : activeView === 'public-profile' ? (
              <PublicProfileView 
                onBack={() => setActiveView('feed')} 
                onOpenMessages={(chatId) => {
                  setActiveChatId(chatId);
                  setActiveView('messages');
                }} 
              />
            ) : activeView === 'profile' ? (
              <ProfileView />
            ) : (
              <div className="flex-1 flex items-center justify-center p-20 text-center">
                 <div className="space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-500">
                    <AlertTriangle size={32} />
                  </div>
                  <p className="text-zinc-500 text-sm">Sección en construcción</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Sidebar - Trends & Metrics */}
          <aside className="hidden lg:flex w-80 shrink-0 p-6 flex-col gap-6 sticky top-0 h-screen overflow-y-auto glass border-r-0 border-y-0">
            <div className="relative group cursor-pointer" onClick={() => setIsSearchOpen(true)}>
              <Search className="absolute left-4 top-2.5 text-zinc-500 group-hover:text-blue-500 transition-colors" size={16} />
              <div className="w-full bg-zinc-900/50 border border-white/5 group-hover:border-blue-500/30 rounded-full py-2 pl-10 pr-4 text-xs text-zinc-500 transition-all">
                Buscar publicaciones...
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 font-mono">
                <TrendingUp size={13} className="text-blue-500" />
                Tendencias
              </h3>
              <div className="space-y-1.5">
                {(() => {
                  const hashtagsMap: Record<string, number> = {};
                  posts.forEach(post => {
                    if (post.content) {
                      const found = post.content.match(/#[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]+/g);
                      if (found) {
                        found.forEach(tag => {
                          hashtagsMap[tag] = (hashtagsMap[tag] || 0) + 1;
                        });
                      }
                    }
                  });

                  const list = Object.entries(hashtagsMap)
                    .map(([tag, count]) => ({ tag, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);

                  if (list.length === 0) {
                    return (
                      <div className="p-4 border border-dashed border-white/5 bg-white/[0.01] rounded-xl text-center">
                        <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
                          No hay tendencias activas en este momento. Usa un hashtag (ej. #TypeScript) para empezar.
                        </p>
                      </div>
                    );
                  }

                  return list.map(({ tag, count }) => (
                    <div 
                      key={tag} 
                      onClick={() => {
                        setSearchQuery(tag);
                        setIsSearchOpen(true);
                      }}
                      className="hover:bg-white/5 p-3 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-white/5 flex flex-col gap-0.5"
                    >
                      <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Tendencias</p>
                      <p className="font-bold text-sm text-white font-mono">{tag}</p>
                      <p className="text-[10px] text-zinc-500">{count} {count === 1 ? 'publicación' : 'publicaciones'}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Global Action Triggers */}
      <div className="fixed bottom-10 right-6 lg:right-8 lg:bottom-8 z-50">
        {user ? (
          <div className="flex flex-col gap-3">
             <button 
              onClick={() => setIsSettingsOpen(true)}
              className="h-12 w-12 rounded-xl glass shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform group border-white/20"
              title="Notification Settings"
            >
              <Settings className="group-hover:rotate-45 transition-transform text-zinc-400" size={20} />
            </button>
            <button 
              onClick={toggleChat}
              className="h-12 w-12 rounded-xl glass shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform group border-white/20 relative"
              title="Chat Global"
            >
              <Mail className="group-hover:rotate-6 transition-transform text-blue-500" size={20} />
              {chats.length > 0 && (
                <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-600 rounded-full border-2 border-[#0A0A0B] flex items-center justify-center text-[8px] font-bold text-white">
                  {chats.length}
                </div>
              )}
            </button>
          </div>
        ) : (
          <button 
            onClick={handleLogin}
            className="group flex items-center gap-3 glass text-white px-5 py-3 rounded-xl font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all border-white/20 text-sm"
          >
            <LogIn size={18} className="text-blue-500" />
            Connect via Auth
          </button>
        )}
      </div>

      <ChatWindow />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} />
      <SearchOverlay 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onOpenMessages={(chatId) => {
          setActiveView('messages');
          setActiveChatId(chatId);
        }}
      />
      <NotificationSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-xl border-t border-white/5 flex lg:hidden items-center justify-around px-4 z-50">
        <button onClick={() => setActiveView('feed')} className={cn("p-2", activeView === 'feed' ? "text-blue-500" : "text-zinc-500")}><Home size={24} /></button>
        <button onClick={() => setIsSearchOpen(true)} className="p-2 text-zinc-500"><Search size={24} /></button>
        <button onClick={() => setActiveView('messages')} className={cn("p-2", activeView === 'messages' ? "text-blue-500" : "text-zinc-500")}><Mail size={24} /></button>
        <button onClick={() => setActiveView('notifications')} className={cn("p-2 relative", activeView === 'notifications' ? "text-blue-500" : "text-zinc-500")}>
          <Bell size={24} />
          {notifications.filter(n => !n.isRead).length > 0 && (
            <span className="absolute top-1.5 right-1.5 bg-blue-600 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center">
              {notifications.filter(n => !n.isRead).length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveView('profile')} className={cn("p-2", activeView === 'profile' ? "text-blue-500" : "text-zinc-500")}><UserIcon size={24} /></button>
      </nav>

      {/* Real-time Sliding In-App Toast Alert */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            onClick={async () => {
              await markNotificationAsRead(activeToast.id);
              if (activeToast.type === 'message' && activeToast.chatId) {
                setActiveChatId(activeToast.chatId);
                setActiveView('messages');
              } else {
                setActiveView('notifications');
              }
              setActiveToast(null);
            }}
            className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 w-80 max-w-sm bg-zinc-900 border border-blue-500/35 hover:border-blue-500 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 cursor-pointer group hover:scale-[1.02] active:scale-98 transition-all"
          >
            <img 
              src={activeToast.senderPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeToast.senderName}`} 
              alt={activeToast.senderName} 
              className="w-10 h-10 rounded-full border border-white/10 shrink-0 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[9px] uppercase tracking-[0.2em] text-blue-500 font-bold font-mono">Notificación</span>
              <p className="font-bold text-xs text-white truncate">@{activeToast.senderName}</p>
              <p className="text-zinc-400 text-xs truncate leading-normal mt-0.5">{activeToast.contentOrTitle}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}



