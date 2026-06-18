import React, { useState, useEffect } from 'react';
import { useNexusStore } from '../store';
import { Settings, LogOut, Terminal, Layers, Globe, Edit3, X, Save, Check, User as UserIcon, Camera, Image as ImageIcon } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { updateProfile } from '../services/firebaseService';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { PostCard } from './PostCard';
import { FollowListModal } from './FollowListModal';

export function ProfileView() {
  const { user } = useNexusStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ 
    displayName: '', 
    bio: '', 
    username: '',
    photoURL: '',
    bannerURL: ''
  });
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState<'followers' | 'following'>('followers');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (user) {
      setEditData({
        displayName: user.displayName || '',
        bio: user.bio || '',
        username: user.username || '',
        photoURL: user.photoURL || '',
        bannerURL: user.bannerURL || ''
      });
      fetchUserPosts();
    }
  }, [user]);

  const fetchUserPosts = async () => {
    if (!user?.uid) return;
    setLoadingPosts(true);
    try {
      const q = query(
        collection(db, 'posts'), 
        where('authorId', '==', user.uid)
      );
      const snap = await getDocs(q);
      const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      posts.sort((a: any, b: any) => {
        const t1 = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime();
        const t2 = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime();
        return t2 - t1;
      });
      setUserPosts(posts);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedDataUrl = await compressImage(file, 800, 400);
        setEditData(prev => ({ ...prev, bannerURL: compressedDataUrl }));
      } catch (err) {
        console.error("Error compressing banner", err);
      }
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedDataUrl = await compressImage(file, 400, 400);
        setEditData(prev => ({ ...prev, photoURL: compressedDataUrl }));
      } catch (err) {
        console.error("Error compressing photo", err);
      }
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await updateProfile(editData);
      setIsEditing(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex-1 min-h-screen bg-[#0A0A0B]">
      <header className="h-14 border-b border-white/5 px-6 flex items-center bg-[#0A0A0BC0] backdrop-blur-md sticky top-0 z-20 justify-between">
        <h2 className="text-xs font-bold text-white tracking-wider uppercase font-mono">Mi Perfil</h2>
        <div className="flex items-center gap-4">
           {user.isAdmin && <span className="text-[10px] bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded font-mono font-bold">ADMINISTRADOR</span>}
        </div>
      </header>

      {/* Banner Area */}
      <div className="relative w-full">
        <div className="h-44 w-full relative overflow-hidden bg-gradient-to-tr from-blue-950/40 to-zinc-900 border-b border-white/5">
          {(isEditing ? editData.bannerURL : user.bannerURL) ? (
            <img 
              src={isEditing ? editData.bannerURL : user.bannerURL} 
              alt="Banner" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-zinc-950 via-zinc-900/50 to-blue-950/20" />
          )}
          
          {isEditing && (
            <label className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center cursor-pointer hover:bg-black/65 transition-all font-mono text-[10px] uppercase font-bold tracking-widest text-white/90">
              <span className="bg-zinc-950/80 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all">
                <Camera size={12} className="text-blue-500" />
                Actualizar foto de portada
              </span>
              <input type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
            </label>
          )}
        </div>

        {/* Circular Avatar aligned with the content constraints */}
        <div className="max-w-4xl mx-auto w-full relative px-6 md:px-8">
          <div className="absolute -top-14 left-6 md:left-8 p-1 bg-[#0A0A0B] rounded-full z-10">
            <img 
              src={isEditing ? (editData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`) : (user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`)} 
              alt="Avatar" 
              className="w-28 h-28 rounded-full border-4 border-[#0A0A0B] object-cover bg-zinc-900"
              referrerPolicy="no-referrer"
            />
            {isEditing && (
              <label className="absolute inset-1 rounded-full bg-black/65 flex flex-col items-center justify-center cursor-pointer transition-all font-mono text-[8.5px] uppercase font-bold tracking-wider text-white">
                <Camera size={14} className="text-blue-500 mb-0.5" />
                Editar Foto
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-10 pt-20 md:pt-24">
        {/* Profile Details */}
        <div className="flex flex-col md:flex-row gap-8 items-start text-left justify-between">
          <div className="flex-1 space-y-4 w-full">
            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4 bg-white/5 p-6 rounded-2xl border border-white/5"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Nombre para mostrar</label>
                      <input 
                        value={editData.displayName}
                        onChange={e => setEditData(prev => ({ ...prev, displayName: e.target.value }))}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-blue-500 font-sans"
                      />
                    </div>
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Nombre de usuario</label>
                      <input 
                        value={editData.username}
                        onChange={e => setEditData(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full bg-zinc-900 border border-white/10 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Biografía</label>
                    <textarea 
                      value={editData.bio}
                      onChange={e => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg py-2 px-3 text-sm text-white outline-none focus:border-blue-500 h-20 resize-none font-sans"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button 
                      onClick={() => setIsEditing(false)} 
                      className="px-4 py-2 text-xs font-bold font-mono uppercase text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSave} 
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                    >
                      {isSaving ? "Guardando..." : "Guardar cambios"}
                      <Save size={14} />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">{user.displayName || 'Usuario'}</h1>
                    <p className="text-zinc-500 font-mono text-xs">@{user.username || 'usuario'}</p>
                  </div>
                  <p className="text-zinc-300 text-sm leading-relaxed p-4 bg-white/[0.02] rounded-xl border border-white/5 font-sans">
                    {user.bio || "Este usuario no ha definido una biografía aún."}
                  </p>
                  <div className="flex gap-8 justify-start pt-2">
                    <StatItem label="Publicaciones" value={userPosts.length.toString()} />
                    <StatItem 
                      label="Seguidores" 
                      value={user.followersCount?.toString() || '0'} 
                      onClick={() => { setFollowModalType('followers'); setFollowModalOpen(true); }}
                    />
                    <StatItem 
                      label="Siguiendo" 
                      value={user.followingCount?.toString() || '0'} 
                      onClick={() => { setFollowModalType('following'); setFollowModalOpen(true); }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-full text-xs font-bold font-mono uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 justify-center cursor-pointer active:scale-95"
              >
                <Edit3 size={13} />
                Editar perfil
              </button>
            )}
            <button 
              onClick={() => signOut(auth)}
              className="bg-red-500/5 border border-red-500/10 text-red-400 px-4 py-2.5 rounded-full text-xs font-bold font-mono uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center gap-2 justify-center cursor-pointer active:scale-95"
            >
              <LogOut size={13} />
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* User Posts list */}
        <div className="space-y-6 pt-6 border-t border-white/5">
          <div className="flex items-center gap-4 px-2">
            <button className="text-xs font-bold font-mono uppercase tracking-wider text-white border-b-2 border-blue-500 pb-2">Mis Publicaciones</button>
            <button className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-600 pb-2 cursor-not-allowed">Multimedia</button>
            <button className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-600 pb-2 cursor-not-allowed">Favoritos</button>
          </div>
          
          <div className="space-y-0">
            {loadingPosts ? (
              <div className="py-16 text-center text-zinc-600 font-mono animate-pulse uppercase tracking-wider text-xs">Cargando publicaciones...</div>
            ) : userPosts.length > 0 ? (
              userPosts.map(post => <PostCard key={post.id} post={post} />)
            ) : (
              <div className="py-16 text-center space-y-4 max-w-xs mx-auto">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-zinc-700">
                  <UserIcon size={24} />
                </div>
                <p className="text-zinc-600 font-mono text-xs uppercase tracking-wider leading-relaxed">No has realizado ninguna publicación en el feed.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <FollowListModal
        isOpen={followModalOpen}
        onClose={() => setFollowModalOpen(false)}
        userId={user.uid}
        type={followModalType}
      />
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full shadow-lg font-mono text-xs flex items-center justify-center backdrop-blur-md"
          >
            Cambios guardados exitosamente
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, onClick }: { label: string, value: string, onClick?: () => void }) {
  return (
    <div 
      className={`flex flex-col items-start ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      onClick={onClick}
    >
      <p className="text-xl font-bold text-white tracking-tight font-sans">{value}</p>
      <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold leading-tight mt-0.5">{label}</p>
    </div>
  );
}
