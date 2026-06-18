import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, ArrowLeft, MessageSquare, Plus, UserPlus, Circle, User as UserIcon } from 'lucide-react';
import { useNexusStore } from '../store';
import { renderTextWithLinks } from '../lib/linkify';
import { 
  subscribeToChats, 
  subscribeToMessages, 
  sendMessage, 
  getAllUsers, 
  startChat,
  isUserOnline
} from '../services/firebaseService';
import { ChatMessage, User } from '../types';
import { cn } from '../lib/utils';
import { auth, db } from '../firebase';
import { onSnapshot, doc } from 'firebase/firestore';

// Sub-component to track other user's real-time online status
function UserOnlineIndicator({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!userId || !auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data());
      }
    }, (error) => {
      console.warn("[Nexus] Online status snap error:", error.message);
    });
    return () => unsub();
  }, [userId]);

  const isOnline = isUserOnline(profile);

  return (
    <span className={cn(
      "w-1.5 h-1.5 rounded-full absolute bottom-0 right-0 border border-black",
      isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"
    )} />
  );
}

export function ChatWindow() {
  const { isChatOpen, toggleChat, user, activeChatId, setActiveChatId } = useNexusStore();
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [showUserSelector, setShowUserSelector] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to all ongoing conversations of current authenticated user
  useEffect(() => {
    if (!auth.currentUser || !isChatOpen) return;
    const unsubscribe = subscribeToChats((updatedChats) => {
      setChats(updatedChats);
    });
    return () => unsubscribe();
  }, [isChatOpen, user]);

  // Subscribe to messages in real-time if a chat room is active
  useEffect(() => {
    if (!activeChatId || !isChatOpen) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeToMessages(activeChatId, (newMessages) => {
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [activeChatId, isChatOpen]);

  // Handle auto scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showUserSelector, activeChatId]);

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeChatId || !auth.currentUser) return;

    const currentText = text;
    setText('');
    try {
      await sendMessage(activeChatId, currentText);
    } catch (error) {
      console.error("[Nexus Chat] Error sending message:", error);
    }
  };

  // Open users list to compose dynamic new chat
  const handleOpenUserSelector = async () => {
    setLoadingUsers(true);
    setShowUserSelector(true);
    try {
      const list = await getAllUsers();
      setAvailableUsers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSelectUser = async (otherUser: User) => {
    try {
      const chatId = await startChat(otherUser.uid, otherUser);
      setActiveChatId(chatId);
      setShowUserSelector(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Find info about the other dialog participant in a chat room
  const getOtherParticipant = (chat: any) => {
    if (!auth.currentUser) return { displayName: 'Usuario', photoURL: '' };
    const participants = chat.participantDetails || [];
    return participants.find((p: any) => p.uid !== auth.currentUser?.uid) || { displayName: 'Usuario', photoURL: '' };
  };

  // Active chat header info
  const activeChat = chats.find(c => c.id === activeChatId);
  const otherParticipant = activeChat ? getOtherParticipant(activeChat) : null;

  return (
    <AnimatePresence>
      {isChatOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          className="fixed bottom-24 right-5 sm:right-6 w-[340px] h-[500px] glass rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden z-50 border border-white/10"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-white/5 bg-zinc-900/90 flex items-center justify-between">
            {activeChatId || showUserSelector ? (
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={() => {
                    setActiveChatId(null);
                    setShowUserSelector(false);
                  }} 
                  className="p-1 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Volver"
                >
                  <ArrowLeft size={16} />
                </button>
                {showUserSelector ? (
                  <div>
                    <h4 className="font-bold text-xs text-white uppercase tracking-wider font-mono">Nuevo Mensaje</h4>
                    <span className="text-[9px] text-zinc-500 font-mono text-emerald-400">SELECCIONE DESTINATARIO</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <img 
                        src={otherParticipant?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherParticipant?.uid || 'chat'}`} 
                        alt="Avatar" 
                        className="w-7 h-7 rounded-full object-cover bg-zinc-800"
                        referrerPolicy="no-referrer"
                      />
                      {otherParticipant?.uid && <UserOnlineIndicator userId={otherParticipant.uid} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white leading-tight font-sans truncate max-w-[150px]">
                        {otherParticipant?.displayName || 'Chat'}
                      </h4>
                      <span className="text-[9px] text-zinc-400 font-mono tracking-wider">Chat Privado</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="font-bold text-xs text-white uppercase tracking-wider font-mono">Mensajes</span>
                <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold">LIVE</span>
              </div>
            )}
            
            <div className="flex items-center gap-1.5">
              {!activeChatId && !showUserSelector && (
                <button 
                  onClick={handleOpenUserSelector}
                  className="p-1.5 hover:bg-white/5 rounded-full text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  title="Nueva conversación"
                >
                  <UserPlus size={15} />
                </button>
              )}
              <button onClick={toggleChat} className="p-1.5 hover:bg-white/5 rounded-full text-zinc-500 hover:text-red-400 transition-colors cursor-pointer">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Main Workspace content */}
          <div className="flex-1 overflow-hidden flex flex-col bg-zinc-950/25">
            {/* 1. Direct Message Chat Room View */}
            {activeChatId && !showUserSelector ? (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar bg-zinc-950/50">
                  {messages.map((msg) => {
                    const isMine = msg.senderId === user?.uid;
                    return (
                      <div key={msg.id} className={cn("flex flex-col", isMine ? "items-end" : "items-start")}>
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words",
                          isMine 
                            ? "bg-blue-600 text-white rounded-tr-none shadow-[0_2px_8px_rgba(59,130,246,0.3)]" 
                            : "bg-white/5 text-zinc-200 border border-white/5 rounded-tl-none"
                        )}>
                          {renderTextWithLinks(msg.text)}
                        </div>
                        {msg.createdAt && (
                          <span className="text-[9px] text-zinc-600 mt-1 font-mono px-1">
                            {new Date(msg.createdAt.toDate?.() || msg.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                      <div className="p-3 bg-white/5 rounded-full text-zinc-500">
                        <MessageSquare size={20} />
                      </div>
                      <p className="text-zinc-600 text-[10px] uppercase font-mono tracking-widest leading-relaxed">
                        No hay mensajes anteriores en este chat. ¡Escribe un mensaje para empezar!
                      </p>
                    </div>
                  )}
                </div>

                {/* Send action bar */}
                <form onSubmit={handleSend} className="p-3 bg-zinc-900/90 border-t border-white/5">
                  <div className="relative">
                    <input 
                      type="text" 
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Escribe un mensaje..."
                      className="w-full bg-zinc-950 border border-white/5 rounded-full py-2 pl-4 pr-10 text-[11px] text-white outline-none focus:border-blue-500 focus:ring-0 transition-all font-mono"
                    />
                    <button 
                      type="submit"
                      disabled={!text.trim()}
                      className="absolute right-2 top-1.5 p-1 text-blue-500 hover:text-blue-400 disabled:opacity-0 transition-all active:scale-90 cursor-pointer"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </form>
              </>
            ) : showUserSelector ? (
              /* 2. New DM Composer User Selector */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {loadingUsers ? (
                    <div className="py-20 text-center text-zinc-500 font-mono uppercase text-[10px] tracking-wider animate-pulse">
                      Cargando usuarios...
                    </div>
                  ) : availableUsers.length > 0 ? (
                    availableUsers.map((u) => (
                      <div 
                        key={u.uid}
                        onClick={() => handleSelectUser(u)}
                        className="p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-all"
                      >
                        <div className="relative">
                          <img 
                            src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                            alt={u.displayName} 
                            className="w-8 h-8 rounded-full border border-white/10 object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <UserOnlineIndicator userId={u.uid} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-white truncate leading-tight">{u.displayName}</p>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">@{u.username || 'user'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-16 text-center text-zinc-600 font-mono text-[10px] uppercase">
                      No se encontraron usuarios en la red
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 3. Conversations list */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03] p-1.5">
                  {chats.length > 0 ? (
                    chats.map((c) => {
                      const other = getOtherParticipant(c);
                      const active = c.id === activeChatId;
                      
                      return (
                        <div 
                          key={c.id}
                          onClick={() => setActiveChatId(c.id)}
                          className={cn(
                            "p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all hover:bg-white/5",
                            active ? "bg-white/5" : ""
                          )}
                        >
                          <div className="relative shrink-0">
                            <img 
                              src={other?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${other?.uid || 'chat'}`} 
                              alt={other?.displayName} 
                              className="w-10 h-10 rounded-full border border-white/10 object-cover bg-zinc-900"
                              referrerPolicy="no-referrer"
                            />
                            {other?.uid && <UserOnlineIndicator userId={other.uid} />}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline">
                              <p className="font-bold text-xs text-white truncate leading-tight">{other?.displayName || 'Directo'}</p>
                              {c.updatedAt && (
                                <span className="text-[9px] text-zinc-500 font-mono">
                                  {new Date(c.updatedAt.toDate?.() || c.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 font-mono truncate mt-1 leading-relaxed">
                              {c.lastMessage || 'Conversación iniciada'}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 pt-24">
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-full text-zinc-600">
                        <MessageSquare size={24} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-white text-xs font-bold font-mono uppercase tracking-wider">Buzón de DM Vacío</p>
                        <p className="text-zinc-600 text-[10px] leading-relaxed max-w-xs mx-auto">
                          No tienes conversaciones activas. Haz clic en el botón de abajo para iniciar una conversación.
                        </p>
                      </div>
                      <button 
                        onClick={handleOpenUserSelector}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold font-mono uppercase tracking-widest rounded-full transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={12} />
                        Nueva conversación
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
