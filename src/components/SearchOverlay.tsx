import React, { useState, useEffect } from 'react';
import { Search, X, Calendar, Filter, Users, Hash, FileText, MessageCircle } from 'lucide-react';
import { searchContent, startChat } from '../services/firebaseService';
import { motion, AnimatePresence } from 'motion/react';
import { Post, User } from '../types';
import { PostCard } from './PostCard';
import { auth } from '../firebase';
import { useNexusStore } from '../store';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMessages?: (chatId: string) => void;
}

export function SearchOverlay({ isOpen, onClose, onOpenMessages }: SearchOverlayProps) {
  const { setViewedUserId, setActiveView, searchQuery, setSearchQuery } = useNexusStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<{ posts: Post[], users: User[] }>({ posts: [], users: [] });
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'users' | 'hashtags'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(searchQuery);
    }
  }, [isOpen, searchQuery]);

  const handleClose = () => {
    setSearchQuery('');
    setSearchTerm('');
    onClose();
  };

  const handleStartChat = async (userId: string, userData: any) => {
    if (!auth.currentUser) return;
    try {
      const chatId = await startChat(userId, userData);
      handleClose();
      if (onOpenMessages) {
        onOpenMessages(chatId);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleViewProfile = (userId: string) => {
    setViewedUserId(userId);
    setActiveView('public-profile');
    handleClose();
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setLoading(true);
        try {
          const [posts, users] = await Promise.all([
            searchContent(searchTerm, 'posts'),
            searchContent(searchTerm, 'users')
          ]);
          setResults({ 
            posts: posts as Post[], 
            users: users as unknown as User[] 
          });
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults({ posts: [], users: [] });
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center pt-20 px-4"
        >
          <div className="w-full max-w-2xl relative">
            <button 
              onClick={handleClose}
              className="absolute -top-12 right-0 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>

            <div className="relative group mb-8">
              <Search className="absolute left-6 top-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" size={24} />
              <input 
                autoFocus
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search posts, users or #hashtags..."
                className="w-full bg-zinc-900/50 border-2 border-white/5 rounded-2xl py-4 pl-16 pr-6 text-lg text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-mono shadow-2xl"
              />
            </div>

            <div className="flex gap-2 mb-8 no-scrollbar overflow-x-auto pb-2">
              <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} icon={Filter} label="All" />
              <TabButton active={activeTab === 'posts'} onClick={() => setActiveTab('posts')} icon={FileText} label="Posts" />
              <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={Users} label="Users" />
              <TabButton active={activeTab === 'hashtags'} onClick={() => setActiveTab('hashtags')} icon={Hash} label="Hashtags" />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar max-h-[60vh] pb-10">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold px-2">Users Found</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {results.users.map(userResult => (
                          <div 
                            key={userResult.uid} 
                            onClick={() => handleViewProfile(userResult.uid)}
                            className="glass p-3 rounded-xl flex items-center gap-3 border-white/5 hover:border-white/10 transition-all cursor-pointer group"
                          >
                            <img src={userResult.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userResult.uid}`} alt={userResult.username} className="h-10 w-10 rounded-full border border-white/10 object-cover" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-white truncate">{userResult.displayName}</p>
                              <p className="text-xs text-zinc-500 truncate">@{userResult.username}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleStartChat(userResult.uid, userResult); }}
                                className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                                title="Send Message"
                              >
                                <MessageCircle size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(activeTab === 'all' || activeTab === 'posts') && results.posts.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold px-2">Publicaciones</h4>
                      <div className="divide-y divide-white/5 border border-white/5 rounded-2xl overflow-hidden glass">
                        {results.posts.map(post => (
                          <PostCard key={post.id} post={post} />
                        ))}
                      </div>
                    </div>
                  )}

                  {searchTerm.length >= 2 && results.posts.length === 0 && results.users.length === 0 && (
                    <div className="text-center py-20">
                      <p className="text-zinc-500 text-sm">No se encontraron resultados</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
          : "bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
