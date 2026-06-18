import React, { useState, useEffect } from 'react';
import { useNexusStore } from '../store';
import { ArrowLeft, MapPin, Link as LinkIcon, Calendar, MessageCircle, BadgeCheck, Wifi, WifiOff } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PostCard } from './PostCard';
import { startChat, followUser, unfollowUser, isFollowingUser, isUserOnline } from '../services/firebaseService';
import { FollowListModal } from './FollowListModal';

interface PublicProfileViewProps {
  onBack: () => void;
  onOpenMessages: (chatId: string) => void;
}

export function PublicProfileView({ onBack, onOpenMessages }: PublicProfileViewProps) {
  const { viewedUserId, user, setAuthModalOpen } = useNexusStore();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalType, setFollowModalType] = useState<'followers' | 'following'>('followers');

  useEffect(() => {
    if (!viewedUserId) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const userDoc = await getDoc(doc(db, 'users', viewedUserId));
        if (userDoc.exists()) {
          const profileData = userDoc.data();
          setProfile(profileData);
          setFollowersCount(profileData.followersCount || 0);
          setFollowingCount(profileData.followingCount || 0);
        } else {
          setProfile(null);
        }

        // Check follow association
        if (auth.currentUser && viewedUserId) {
          const following = await isFollowingUser(viewedUserId);
          setIsFollowing(following);
        }

        const q = query(
          collection(db, 'posts'),
          where('authorId', '==', viewedUserId)
        );
        const postsSnap = await getDocs(q);
        const pList = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        pList.sort((a: any, b: any) => {
          const t1 = a.createdAt?.toMillis?.() || new Date(a.createdAt).getTime();
          const t2 = b.createdAt?.toMillis?.() || new Date(b.createdAt).getTime();
          return t2 - t1;
        });
        setPosts(pList);
      } catch (err) {
        console.error("Error al obtener perfil", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [viewedUserId]);

  const handleMessage = async () => {
    if (!auth.currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!viewedUserId || !profile) return;
    try {
      const chatId = await startChat(viewedUserId, profile);
      onOpenMessages(chatId);
    } catch (error) {
      console.error(error);
    }
  };

  const handleFollowToggle = async () => {
    if (!auth.currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!viewedUserId || actionLoading) return;
    try {
      setActionLoading(true);
      if (isFollowing) {
        await unfollowUser(viewedUserId);
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        await followUser(viewedUserId);
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } catch (err) {
      console.error("Error al cambiar estado de seguimiento", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full bg-[#0A0A0B]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile && !loading) {
    return (
      <div className="flex-1 p-10 text-center text-zinc-500 bg-[#0A0A0B] font-mono">
        Perfil no encontrado en la plataforma.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0B] overflow-y-auto">
      <header className="h-14 border-b border-white/5 px-4 flex items-center gap-6 bg-[#0A0A0BC0] backdrop-blur-md sticky top-0 z-20">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full transition-colors text-white cursor-pointer">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="font-bold text-sm text-white leading-tight flex items-center gap-1.5 font-mono uppercase tracking-wider">
            {profile.displayName || profile.username || 'Usuario'}
            {profile.isAdmin && <span className="bg-red-500/10 text-red-500 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">Admin</span>}
          </h2>
          <span className="text-[10px] text-zinc-500 font-mono">{posts.length} {posts.length === 1 ? 'publicación' : 'publicaciones'}</span>
        </div>
      </header>

      {/* Banner Area */}
      {/* Banner Area */}
      <div className="relative w-full">
        <div className="h-40 w-full relative overflow-hidden bg-gradient-to-tr from-blue-950/50 to-zinc-900 border-b border-white/5">
          {profile.bannerURL ? (
            <img 
              src={profile.bannerURL} 
              alt="Banner" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-zinc-950 via-zinc-900/50 to-blue-950/20" />
          )}
        </div>
        <div className="max-w-4xl mx-auto w-full relative px-6">
          <div className="absolute -top-14 left-6 p-1 bg-[#0A0A0B] rounded-full z-10">
            <img 
              src={profile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${viewedUserId}`}
              alt="Profile avatar" 
              className="w-28 h-28 rounded-full border-4 border-[#0A0A0B] object-cover bg-zinc-900"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* User Info Area */}
      <div className="max-w-4xl mx-auto w-full px-6 pt-20 md:pt-24 pb-5 border-b border-white/5">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-white tracking-tight">{profile.displayName || 'Usuario'}</h1>
              {isUserOnline(profile) ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En línea
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-500/5 border border-white/5 px-2 py-0.5 rounded-full font-mono uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  Desconectado {profile.lastSeen ? `(u.v: ${new Date(profile.lastSeen.toDate()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})` : ''}
                </span>
              )}
            </div>
            <p className="text-zinc-500 text-xs font-mono">@{profile.username || 'user'}</p>
          </div>
          
          {user?.uid !== viewedUserId && (
            <div className="flex gap-2">
              <button 
                onClick={handleMessage}
                className="p-2 border border-white/10 rounded-full hover:bg-white/5 transition-all text-white hover:border-white/20 active:scale-95 cursor-pointer"
                title="Enviar Mensaje Directo"
              >
                <MessageCircle size={18} />
              </button>
              <button 
                onClick={handleFollowToggle}
                disabled={actionLoading}
                className={`px-5 py-1.5 text-xs font-bold font-mono uppercase tracking-wider rounded-full transition-all active:scale-95 cursor-pointer ${
                  isFollowing 
                    ? 'border border-white/15 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/5 text-zinc-300' 
                    : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {isFollowing ? 'Siguiendo' : 'Seguir'}
              </button>
            </div>
          )}
        </div>
        
        <p className="mt-3.5 text-zinc-300 text-sm leading-relaxed">{profile.bio || 'Este usuario aún no tiene biografía.'}</p>
        
        <div className="flex flex-wrap gap-4 mt-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><MapPin size={13} /> Comunidad</span>
          <span className="flex items-center gap-1">
            <Calendar size={13} /> 
            Se unió {profile.createdAt ? `el ${new Date(profile.createdAt.toDate()).toLocaleDateString('es-ES')}` : 'recientemente'}
          </span>
        </div>
        
        <div className="flex gap-6 mt-4 text-xs text-zinc-400 font-mono">
          <span 
            className="cursor-pointer hover:underline text-zinc-300"
            onClick={() => { setFollowModalType('following'); setFollowModalOpen(true); }}
          >
            <strong className="text-white text-sm font-sans mr-1">{followingCount}</strong> Siguiendo
          </span>
          <span 
            className="cursor-pointer hover:underline text-zinc-300"
            onClick={() => { setFollowModalType('followers'); setFollowModalOpen(true); }}
          >
            <strong className="text-white text-sm font-sans mr-1">{followersCount}</strong> {followersCount === 1 ? 'Seguidor' : 'Seguidores'}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full flex-1">
        <div className="flex border-b border-white/5 bg-[#0A0A0B]">
          <button className="flex-1 py-3 text-center border-b border-blue-500 font-mono font-bold text-xs uppercase tracking-wider text-white bg-white/[0.01]">
            Publicaciones
          </button>
          <button className="flex-1 py-3 text-center text-xs font-mono uppercase tracking-wider text-zinc-600 cursor-not-allowed">
            Respuestas
          </button>
          <button className="flex-1 py-3 text-center text-xs font-mono uppercase tracking-wider text-zinc-600 cursor-not-allowed">
            Multimedia
          </button>
          <button className="flex-1 py-3 text-center text-xs font-mono uppercase tracking-wider text-zinc-600 cursor-not-allowed">
            Me gusta
          </button>
        </div>
        
        <div className="divide-y divide-white/5 pb-20">
          {posts.length > 0 ? (
            posts.map(post => <PostCard key={post.id} post={post as any} />)
          ) : (
            <div className="p-16 text-center text-zinc-600 font-mono text-xs">
              Este usuario no tiene publicaciones activas en el feed.
            </div>
          )}
        </div>
      </div>
      <FollowListModal
        isOpen={followModalOpen}
        onClose={() => setFollowModalOpen(false)}
        userId={viewedUserId || ''}
        type={followModalType}
      />
    </div>
  );
}
