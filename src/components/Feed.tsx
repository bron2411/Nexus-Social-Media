import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { PostCard } from './PostCard';
import { AddPost } from './AddPost';
import { Post } from '../types';
import { useNexusStore } from '../store';

interface FeedProps {
  posts: Post[];
}

export function Feed({ posts }: FeedProps) {
  const { user } = useNexusStore();
  const [activeTab, setActiveTab] = useState<'para-ti' | 'siguiendo'>('para-ti');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchWithRetry = async (retryCount = 0) => {
      if (!auth.currentUser || !user?.uid || auth.currentUser.uid !== user.uid) return;
      try {
        setLoadingFollowing(true);
        const q = query(collection(db, 'follows'), where('followerId', '==', user.uid));
        const snap = await getDocs(q);
        if (isMounted) {
          const ids = snap.docs.map(doc => doc.data().followingId);
          setFollowingIds(ids);
        }
      } catch (err: any) {
        console.warn("Error al cargar siguiendo ids:", err.code, err.message);
        if (isMounted && err.code === 'permission-denied' && retryCount < 3) {
          console.log(`[Nexus] Retrying load of following IDs in 1s (attempt ${retryCount + 1})...`);
          setTimeout(() => {
            if (isMounted) {
              fetchWithRetry(retryCount + 1);
            }
          }, 1000);
        }
      } finally {
        if (isMounted) {
          setLoadingFollowing(false);
        }
      }
    };
    fetchWithRetry();
    return () => {
      isMounted = false;
    };
  }, [posts, user?.uid]); // Refresh whenever posts (re-publishes) or authenticated user updates

  // Filters
  const filteredPosts = activeTab === 'para-ti' 
    ? posts 
    : posts.filter(post => followingIds.includes(post.authorId));

  return (
    <main className="flex-1 min-w-0 min-h-screen border-r border-white/5 bg-[#0A0A0B]">
      {/* Dynamic Native Tabs */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[#0A0A0BC0] border-b border-white/5">
        <div className="flex">
          <button 
            onClick={() => setActiveTab('para-ti')}
            className={`flex-1 py-4 text-center text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer relative ${
              activeTab === 'para-ti' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Para ti
            {activeTab === 'para-ti' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-500 rounded-full" />
            )}
          </button>
          
          {auth.currentUser && (
            <button 
              onClick={() => setActiveTab('siguiendo')}
              className={`flex-1 py-4 text-center text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer relative ${
                activeTab === 'siguiendo' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Siguiendo
              {activeTab === 'siguiendo' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-500 rounded-full" />
              )}
            </button>
          )}
        </div>
      </header>

      {activeTab === 'para-ti' && <AddPost />}

      <div className="divide-y divide-white/5 no-scrollbar pb-24">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
        ) : activeTab === 'siguiendo' ? (
          <div className="p-16 text-center text-zinc-500 font-mono text-xs">
            <p className="font-bold text-white mb-2 uppercase">Sin publicaciones de seguidos</p>
            No sigues a nadie aún, o las personas que sigues no han publicado nada actualmente. ¡Explora "Para ti" para descubrir nuevos perfiles!
          </div>
        ) : (
          [1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex gap-3 animate-pulse border-b border-white/5">
              <div className="h-10 w-10 rounded-full bg-zinc-900 border border-white/5" />
              <div className="flex-1 space-y-3">
                <div className="h-3 bg-zinc-900 rounded w-1/4" />
                <div className="h-12 bg-zinc-900 rounded w-full" />
                <div className="h-3 bg-zinc-900 rounded w-1/2" />
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
