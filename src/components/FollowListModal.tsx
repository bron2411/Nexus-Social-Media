import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User as UserIcon } from 'lucide-react';
import { useNexusStore } from '../store';
import { getUserFollowers, getUserFollowing } from '../services/firebaseService';
import { User } from '../types';

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
}

export function FollowListModal({ isOpen, onClose, userId, type }: FollowListModalProps) {
  const { setViewedUserId, setActiveView } = useNexusStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      if (type === 'followers') {
        getUserFollowers(userId).then(list => {
          setUsers(list);
          setLoading(false);
        });
      } else {
        getUserFollowing(userId).then(list => {
          setUsers(list);
          setLoading(false);
        });
      }
    } else {
      setUsers([]);
    }
  }, [isOpen, userId, type]);

  const handleViewProfile = (uid: string) => {
    setViewedUserId(uid);
    setActiveView('public-profile');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900/90 z-10 sticky top-0">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                {type === 'followers' ? 'Seguidores' : 'Siguiendo'}
              </h3>
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-zinc-500 space-y-2">
                  <UserIcon size={24} className="opacity-50" />
                  <p className="text-xs font-mono uppercase tracking-widest">
                    No hay usuarios
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {users.map(u => (
                    <div 
                      key={u.uid}
                      onClick={() => handleViewProfile(u.uid)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <img 
                        src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                        alt="Avatar" 
                        className="w-10 h-10 rounded-full object-cover border border-white/10"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate leading-tight">
                          {u.displayName}
                        </p>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate uppercase">
                          @{u.username}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
