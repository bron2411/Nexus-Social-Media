import React, { useState, useEffect, useRef } from 'react';
import { useNexusStore } from '../store';
import { renderTextWithLinks } from '../lib/linkify';
import { 
  Mail, 
  Send, 
  User as UserIcon, 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Info, 
  Settings, 
  ArrowLeft, 
  X, 
  Image as ImageIcon, 
  VideoOff, 
  PhoneOff, 
  ShieldAlert,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  subscribeToChats, 
  subscribeToMessages, 
  sendMessage, 
  getAllUsers, 
  startChat,
  isUserOnline
} from '../services/firebaseService';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { auth, db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { User } from '../types';

// LIVE PRESENCE BADGE OR BADGE TRACKING FROM FIRESTORE
function LivePresence({ userId, showLabel = false }: { userId: string, showLabel?: boolean }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!userId || !auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      }
    }, (error) => {
      console.warn("[Nexus] Silent check skipped. Live presence read error:", error.message);
    });
    return () => unsub();
  }, [userId]);

  if (!profile) {
    return showLabel ? <span className="text-[10px] text-zinc-500">Inactivo</span> : null;
  }

  const isOnline = isUserOnline(profile);

  if (showLabel) {
    return (
      <span className={`text-[10px] font-medium tracking-tight ${isOnline ? 'text-green-500' : 'text-zinc-500'}`}>
        {isOnline ? 'En línea' : 'Desconectado'}
      </span>
    );
  }

  return (
    <>
      {isOnline && (
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#0A0A0B] rounded-full animate-pulse" />
      )}
    </>
  );
}

// TWITTER-LIKE NEW DIRECT MESSAGE MODAL COMPOSER
interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string, userData: any) => void;
}

function NewChatModal({ isOpen, onClose, onSelectUser }: NewChatModalProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryText, setQueryText] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getAllUsers().then((res) => {
      setUsers(res);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = users.filter(u => 
    u.displayName?.toLowerCase().includes(queryText.toLowerCase()) ||
    u.username?.toLowerCase().includes(queryText.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md glass rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h3 className="font-bold text-white text-base">New Message</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/5 relative flex items-center">
          <Search size={16} className="absolute left-6 text-zinc-500" />
          <input 
            type="text"
            placeholder="Search people"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="w-full bg-zinc-900 border border-white/5 rounded-full py-2 pl-12 pr-4 text-sm text-white focus:border-blue-500/50 outline-none transition-all font-sans"
            autoFocus
          />
        </div>

        {/* Users list */}
        <div className="flex-1 overflow-y-auto max-h-[400px]">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs animate-pulse">Cargando usuarios...</div>
          ) : filtered.length > 0 ? (
            filtered.map((u) => (
              <div 
                key={u.uid}
                onClick={() => onSelectUser(u.uid, u)}
                className="p-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.03] transition-colors border-b border-white/[0.02]"
              >
                <div className="relative">
                  <img 
                    src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                    alt={u.displayName} 
                    className="w-10 h-10 rounded-full border border-white/10 object-cover" 
                    referrerPolicy="no-referrer"
                  />
                  <LivePresence userId={u.uid} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{u.displayName}</p>
                  <p className="text-zinc-500 text-xs truncate">@{u.username}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-zinc-500">No se encontraron usuarios.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// CALL HUD VOICE / VIDEO HANDSHAKE DISPLAY MODULE
interface CallHUDProps {
  type: 'audio' | 'video';
  userProfile: any;
  onDisconnect: () => void;
}

function CallHUD({ type, userProfile, onDisconnect }: CallHUDProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 bg-[#0A0A0B]/95 z-40 flex flex-col items-center justify-between p-10">
      <div className="text-center space-y-2">
        <div className="flex justify-center gap-2 items-center">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
          <span className="text-[10px] text-red-500 font-sans tracking-widest uppercase font-bold">
            LLAMADA DE {type === 'video' ? 'VIDEO' : 'VOZ'} EN CURSO
          </span>
        </div>
        <p className="text-zinc-500 text-xs">Conexión cifrada de extremo a extremo</p>
      </div>

      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-blue-500/10 animate-ping [animation-duration:2.5s]" />
          <div className="absolute -inset-8 rounded-full bg-blue-500/5 animate-pulse" />
          <img 
            src={userProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=guest`} 
            alt="Avatar" 
            className="w-28 h-28 rounded-full border border-white/20 object-cover relative z-10"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white tracking-tight">{userProfile?.displayName}</h3>
          <p className="text-zinc-500 text-xs">@{userProfile?.username}</p>
        </div>
        
        {/* Dynamic Wave Form visualizer */}
        <div className="flex items-end gap-1 h-8 px-4 py-1">
          {[0.2, 0.4, 0.8, 0.5, 0.9, 0.3, 0.7, 0.5, 0.8, 0.3, 0.6, 0.9, 0.2].map((val, i) => (
            <motion.div 
              key={i} 
              className="w-1 bg-blue-500 rounded-full"
              animate={{ height: [`${val * 10}%`, `${val * 100}%`, `${val * 10}%`] }}
              transition={{ repeat: Infinity, duration: 1 + (i % 3) * 0.2, ease: "easeInOut" }}
            />
          ))}
        </div>

        <p className="font-mono text-xl font-bold tracking-widest text-zinc-300">{formatTime(seconds)}</p>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={onDisconnect} 
          className="bg-red-600 hover:bg-red-500 text-white rounded-full p-4 hover:rotate-135 transition-all shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center gap-2 font-bold px-6 border border-red-500/20 text-xs"
        >
          {type === 'video' ? <VideoOff size={18} /> : <PhoneOff size={18} />}
          <span>Colgar</span>
        </button>
      </div>
    </div>
  );
}

// PROFILE SPECS PANEL DESIGN (RIGHT SIDE DRAWER)
interface InfoPanelProps {
  userProfile: any;
  onClose: () => void;
  onViewProfile: () => void;
}

function InfoPanel({ userProfile, onClose, onViewProfile }: InfoPanelProps) {
  return (
    <div className="w-80 border-l border-white/5 bg-[#0D0D0E] h-full flex flex-col p-6 z-30">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Detalles del Perfil</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-white p-1 hover:bg-white/5 rounded-full transition-all">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-col items-center text-center space-y-4 mb-6">
        <img 
          src={userProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=guest`} 
          alt="Avatar" 
          className="w-20 h-20 rounded-full border border-white/10 object-cover" 
          referrerPolicy="no-referrer"
        />
        <div>
          <h4 className="font-bold text-white text-base tracking-tight">{userProfile?.displayName}</h4>
          <p className="text-zinc-500 text-xs">@{userProfile?.username}</p>
        </div>
        <button 
          onClick={onViewProfile}
          className="bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-white py-2 px-4 rounded-full border border-white/5 transition-colors w-full"
        >
          Ver Perfil Público
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar text-xs">
        <div className="space-y-1">
          <span className="text-zinc-500 uppercase text-[10px] tracking-wider font-semibold">Biografía</span>
          <p className="text-zinc-300 leading-relaxed mt-1 text-xs">{userProfile?.bio || "Este usuario aún no ha escrito una biografía."}</p>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/5 text-zinc-400">
          <div className="flex justify-between">
            <span className="text-zinc-500">Miembro desde</span>
            <span className="text-zinc-300 text-xs">
              {userProfile?.createdAt ? new Date(userProfile.createdAt).getUTCFullYear() : '2026'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Privacidad</span>
            <span className="text-zinc-300 text-xs">Mensajes Privados</span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
          <button 
            onClick={() => alert(`Conversaciones con @${userProfile?.username} silenciadas.`)}
            className="text-left text-xs py-2 text-zinc-400 hover:text-white transition-colors"
          >
            Silenciar conversación
          </button>
          <button 
            onClick={() => alert(`Usuario @${userProfile?.username} reportado a los moderadores.`)}
            className="text-left text-xs py-2 text-red-500 hover:text-red-400 transition-colors"
          >
            Reportar usuario
          </button>
        </div>
      </div>
    </div>
  );
}

// MAIN MESSAGES VIEW CONTROLLER
export function MessagesView() {
  const { user, activeChatId, setActiveChatId, setViewedUserId, setActiveView } = useNexusStore();
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  
  // Real-time sharing media attachment state
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');

  // Info drawer side panel state
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Calls Simulation active status
  const [activeCall, setActiveCall] = useState<{ type: 'audio' | 'video' } | null>(null);

  // Typing status attributes
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTypingState, setIsTypingState] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToChats((newChats) => {
      setChats(newChats);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeChatId) return;
    const unsubscribe = subscribeToMessages(activeChatId, (newMsgs) => {
      setMessages(newMsgs);
    });
    return () => unsubscribe();
  }, [activeChatId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle setting typing statuses in Firestore
  const updateTypingStatus = async (typing: boolean) => {
    if (!activeChatId || !auth.currentUser) return;
    try {
      await setDoc(doc(db, 'chats', activeChatId), {
        typing: {
          [auth.currentUser.uid]: typing
        }
      }, { merge: true });
    } catch (err) {
      console.warn("Unable to update typing trace:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    // Set typing trace to true
    if (!isTypingState) {
      setIsTypingState(true);
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingState(false);
      updateTypingStatus(false);
    }, 3000);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeChatId || (!newMessage.trim() && !mediaUrl.trim()) || !auth.currentUser) return;
    
    const text = newMessage;
    const attachment = mediaUrl;
    
    setNewMessage('');
    setMediaUrl('');
    setShowMediaInput(false);

    // Clear typing trackers instantly
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setIsTypingState(false);
    updateTypingStatus(false);

    try {
      await sendMessage(activeChatId, text, attachment || undefined);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectNewChatUser = async (otherId: string, otherData: any) => {
    if (!auth.currentUser) return;
    try {
      const chatId = await startChat(otherId, otherData);
      setActiveChatId(chatId);
      setIsNewChatOpen(false);
    } catch (error) {
      console.error("[DM] Error starting chat:", error);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const otherParticipant = activeChat?.participantDetails?.find((p: any) => p.uid !== user?.uid);
  const isOtherTyping = activeChat?.typing?.[otherParticipant?.uid] === true;

  // Filter local chats matching DM searches
  const filteredChats = chats.filter(chat => {
    const other = chat.participantDetails?.find((p: any) => p.uid !== user?.uid);
    if (!other) return false;
    const name = other.displayName?.toLowerCase() || '';
    const username = other.username?.toLowerCase() || '';
    const searchVal = chatSearch.toLowerCase();
    return name.includes(searchVal) || username.includes(searchVal);
  });

  const handleViewProfile = (participantId: string) => {
    setViewedUserId(participantId);
    setActiveView('public-profile');
  };

  return (
    <div className="flex-1 flex h-screen bg-[#0A0A0B] overflow-hidden">
      {/* Inbox List */}
      <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-[350px] border-r border-white/5 flex-col glass shrink-0 h-full`}>
        <header className="h-14 border-b border-white/10 px-4 flex items-center justify-between bg-[#0A0A0B]/80 backdrop-blur-xl z-10 shrink-0">
          <span className="text-lg font-bold text-white tracking-tight font-sans">Messages</span>
          <div className="flex gap-2">
             <button 
               onClick={() => alert("Preferencias de mensajes directos actualizadas.")}
               className="text-zinc-400 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all"
               title="Configuración de mensajes"
             >
               <Settings size={18} />
             </button>
             <button 
               onClick={() => setIsNewChatOpen(true)}
               className="text-blue-500 hover:text-blue-400 p-2 hover:bg-blue-500/10 rounded-full transition-all"
               title="New Direct Message"
             >
               <Mail size={18} />
             </button>
          </div>
        </header>

        {/* DM Filtering */}
        <div className="p-4 border-b border-white/5 shrink-0">
          <div className="relative group">
            <Search className="absolute left-4 top-2.5 text-zinc-500 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search Direct Messages" 
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="w-full bg-zinc-900/50 border border-white/5 rounded-full py-2 pl-12 pr-4 text-xs outline-none focus:border-blue-500/50 focus:bg-black transition-all font-sans text-white placeholder-zinc-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredChats.length > 0 ? filteredChats.map((chat) => {
            const op = chat.participantDetails?.find((p: any) => p.uid !== user?.uid);
            const isSelected = activeChatId === chat.id;
            return (
              <div 
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setShowInfoPanel(false);
                }}
                className={`p-4 cursor-pointer hover:bg-white/[0.03] transition-all flex gap-3 items-center group relative border-l-2 ${isSelected ? 'bg-white/[0.05] border-blue-500' : 'border-transparent'}`}
              >
                <div className="relative shrink-0" onClick={(e) => { e.stopPropagation(); if(op) handleViewProfile(op.uid); }}>
                  <img 
                    src={op?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${chat.id}`} 
                    className="w-12 h-12 rounded-full border border-white/10 object-cover hover:scale-105 transition-transform"
                    alt="avatar"
                    referrerPolicy="no-referrer"
                  />
                  {op && <LivePresence userId={op.uid} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-bold text-sm text-zinc-100 truncate group-hover:text-white">{op?.displayName || 'Usuario'}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {chat.lastMessageAt ? formatDistanceToNow(chat.lastMessageAt.toDate(), { addSuffix: false, locale: es }) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate leading-tight">
                    {chat.lastMessage || 'Conversación iniciada'}
                  </p>
                </div>
              </div>
            );
          }) : (
            <div className="p-10 text-center space-y-4">
               <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-700">
                  <Mail size={32} />
               </div>
               <div className="space-y-1">
                 <h3 className="text-xl font-bold text-white">¡Te damos la bienvenida a tu bandeja de entrada!</h3>
                 <p className="text-sm text-zinc-500">Envía mensajes privados a cualquier usuario de la red para iniciar una conversación.</p>
               </div>
               <button 
                 onClick={() => setIsNewChatOpen(true)}
                 className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-full text-xs transition-all cursor-pointer"
               >
                 Enviar mensaje
               </button>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${!activeChatId ? 'hidden md:flex' : 'flex'} flex-1 flex flex-row relative h-full overflow-hidden`}>
        {activeChatId ? (
          <>
            <div className="flex-1 flex flex-col relative h-full overflow-hidden">
              {/* Voice / Video Call Handsfree module */}
              {activeCall && (
                <CallHUD 
                  type={activeCall.type} 
                  userProfile={otherParticipant} 
                  onDisconnect={() => setActiveCall(null)} 
                />
              )}

              <header className="h-14 border-b border-white/10 px-4 flex items-center justify-between sticky top-0 bg-[#0A0A0B]/80 backdrop-blur-xl z-20 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setActiveChatId(null)} className="md:hidden text-zinc-400 p-2"><ArrowLeft size={20} /></button>
                  <div className="relative shrink-0 cursor-pointer" onClick={() => { if(otherParticipant) handleViewProfile(otherParticipant.uid); }}>
                    <img 
                      src={otherParticipant?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChatId}`} 
                      className="w-8 h-8 rounded-full border border-white/10 hover:brightness-110 object-cover"
                      alt="avatar"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span 
                      onClick={() => { if(otherParticipant) handleViewProfile(otherParticipant.uid); }}
                      className="text-sm font-bold text-white tracking-tight leading-none mb-1 hover:underline cursor-pointer truncate"
                    >
                      {otherParticipant?.displayName || 'Conversación'}
                    </span>
                    {otherParticipant && <LivePresence userId={otherParticipant.uid} showLabel={true} />}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={() => setActiveCall({ type: 'audio' })}
                    className="p-2 text-zinc-400 hover:text-white rounded-full transition-all"
                    title="Audio call"
                  >
                    <Phone size={18} />
                  </button>
                  <button 
                    onClick={() => setActiveCall({ type: 'video' })}
                    className="p-2 text-zinc-400 hover:text-white rounded-full transition-all"
                    title="Video call"
                  >
                    <Video size={18} />
                  </button>
                  <button 
                    onClick={() => setShowInfoPanel(!showInfoPanel)}
                    className={`p-2 rounded-full transition-all ${showInfoPanel ? 'text-blue-500 bg-white/5' : 'text-zinc-400 hover:text-white'}`}
                    title="Info Drawer"
                  >
                    <Info size={18} />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-white/[0.01]">
                 <div className="flex flex-col items-center justify-center py-10 opacity-30">
                    <p className="text-xs text-zinc-500 font-sans tracking-wide">Conversación privada</p>
                 </div>
                 
                 {messages.map((msg) => {
                   const isMe = msg.senderId === user?.uid;
                   return (
                     <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] space-y-1`}>
                          <div className={`p-3 rounded-2xl text-sm leading-relaxed break-words ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-zinc-800 text-zinc-100 rounded-tl-none'}`}>
                            {renderTextWithLinks(msg.text)}
                            {msg.mediaUrl && (
                              <div className="mt-2 rounded-lg overflow-hidden border border-white/5 max-h-48">
                                <img src={msg.mediaUrl} alt="DM attachment" className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                              </div>
                            )}
                          </div>
                          <p className={`text-[9px] font-mono text-zinc-600 ${isMe ? 'text-right' : 'text-left'}`}>
                            {msg.createdAt ? formatDistanceToNow(msg.createdAt.toDate(), { locale: es }) : 'syncing...'}
                          </p>
                        </div>
                     </div>
                   );
                 })}

                 {/* Real-time typing indicators */}
                 {isOtherTyping && (
                   <div className="flex justify-start">
                     <div className="max-w-[70%] space-y-1">
                       <div className="p-3 bg-zinc-900 text-zinc-400 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                         <span className="flex gap-1 shrink-0">
                           <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                           <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                           <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                         </span>
                         <span className="font-sans text-[10px] tracking-wide text-zinc-500">{otherParticipant?.displayName || 'Usuario'} está escribiendo...</span>
                       </div>
                     </div>
                   </div>
                 )}

                 <div ref={scrollRef} />
              </div>

              {/* Composition footer with media support */}
              <div className="p-4 border-t border-white/10 bg-[#0A0A0B] shrink-0">
                <form onSubmit={handleSendMessage} className="relative flex flex-col gap-2 max-w-4xl mx-auto">
                  {/* Media link input overlay */}
                  {showMediaInput && (
                    <div className="p-3 bg-zinc-900 border border-white/10 rounded-xl mb-1 flex gap-2 items-center">
                       <input 
                         type="text"
                         placeholder="Paste image URL (Unsplash/Imgur etc)..."
                         value={mediaUrl}
                         onChange={(e) => setMediaUrl(e.target.value)}
                         className="flex-1 bg-zinc-950 border border-white/5 rounded-lg py-1.5 px-3 text-xs text-blue-400 outline-none focus:border-blue-500/50 font-mono"
                       />
                       {mediaUrl && (
                         <img src={mediaUrl} className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0" alt="Preview" referrerPolicy="no-referrer" />
                       )}
                       <button type="button" onClick={() => setShowMediaInput(false)} className="text-zinc-400 hover:text-white p-1">
                         <X size={14} />
                       </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={handleInputChange}
                        placeholder="Escribe un mensaje..." 
                        className="w-full bg-zinc-900 border border-white/5 rounded-full py-2.5 px-6 pr-12 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-sans" 
                      />
                      <div className="absolute right-3 top-1.5 flex gap-1">
                        <button 
                          type="button" 
                          onClick={() => setShowMediaInput(!showMediaInput)}
                          className={`p-1.5 transition-colors ${showMediaInput ? 'text-blue-500' : 'text-zinc-500 hover:text-blue-500'}`}
                          title="Attach Image"
                        >
                          <ImageIcon size={16} />
                        </button>
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={!newMessage.trim() && !mediaUrl.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:grayscale text-white p-2.5 rounded-full transition-all shadow-lg shadow-blue-600/20"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Info Side Drawer Panel */}
            {showInfoPanel && otherParticipant && (
              <InfoPanel 
                userProfile={otherParticipant} 
                onClose={() => setShowInfoPanel(false)} 
                onViewProfile={() => handleViewProfile(otherParticipant.uid)} 
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#0A0A0B]">
            <div className="max-w-sm space-y-4">
              <h2 className="text-3xl font-black text-white tracking-tight leading-none">Selecciona un chat</h2>
              <p className="text-zinc-500 text-sm">Elige entre tus conversaciones existentes o inicia una nueva para hablar con tus amigos.</p>
              <button 
                onClick={() => setIsNewChatOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-full text-xs transition-all cursor-pointer"
              >
                New Message
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Composition triggers overlay */}
      <NewChatModal 
        isOpen={isNewChatOpen} 
        onClose={() => setIsNewChatOpen(false)} 
        onSelectUser={handleSelectNewChatUser} 
      />
    </div>
  );
}
