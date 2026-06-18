import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, Repeat2, MoreHorizontal, AlertTriangle, Edit3, Trash, X, User, ThumbsUp, ThumbsDown, Reply } from 'lucide-react';
import { Post } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import React, { useState, useEffect } from 'react';
import { ReportModal } from './ReportModal';
import { 
  likePost, 
  unlikePost, 
  retweetPost, 
  unretweetPost,
  deletePost,
  updatePostContent,
  reactToComment,
  replyToComment
} from '../services/firebaseService';
import { auth, db } from '../firebase';
import { useNexusStore } from '../store';
import { query, collection, orderBy, getDocs, addDoc, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore';
import { renderTextWithLinks } from '../lib/linkify';

interface PostCardProps {
  post: Post;
  key?: string;
}

export function PostCard({ post }: PostCardProps) {
  const { setViewedUserId, setActiveView, user, usersMap, setAuthModalOpen } = useNexusStore();

  // Component local UI States
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isMediaZoomed, setIsMediaZoomed] = useState(false);

  // Comments state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Comment replies & reactions states
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  
  const [localLikes, setLocalLikes] = useState(post.likesCount || 0);
  const [localRTs, setLocalRTs] = useState(post.retweetsCount || 0);
  const [isLiked, setIsLiked] = useState(user ? post.likedBy?.includes(user.uid) || false : false);
  const [isRTed, setIsRTed] = useState(user ? post.retweetedBy?.includes(user.uid) || false : false);

  React.useEffect(() => {
    setLocalLikes(post.likesCount || 0);
    setLocalRTs(post.retweetsCount || 0);
    if (user) {
      setIsLiked(post.likedBy?.includes(user.uid) || false);
      setIsRTed(post.retweetedBy?.includes(user.uid) || false);
    }
  }, [post.likesCount, post.retweetsCount, post.likedBy, post.retweetedBy, user?.uid]);

  React.useEffect(() => {
    setEditContent(post.content);
  }, [post.content]);

  // Close menus on outside click helper
  React.useEffect(() => {
    if (!isMenuOpen) return;
    const closeMenu = () => setIsMenuOpen(false);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [isMenuOpen]);

  // Social interactions
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLocalLikes(prev => newLiked ? prev + 1 : prev - 1);
    try {
      if (newLiked) {
        await likePost(post.id);
      } else {
        await unlikePost(post.id);
      }
    } catch (error) {
      setIsLiked(!newLiked);
      setLocalLikes(prev => !newLiked ? prev + 1 : prev - 1);
      console.error(error);
    }
  };

  const handleRetweet = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) {
      setAuthModalOpen(true);
      return;
    }
    const newRTed = !isRTed;
    setIsRTed(newRTed);
    setLocalRTs(prev => newRTed ? prev + 1 : prev - 1);
    try {
      if (newRTed) {
        await retweetPost(post.id);
      } else {
        await unretweetPost(post.id);
      }
    } catch (error) {
      setIsRTed(!newRTed);
      setLocalRTs(prev => !newRTed ? prev + 1 : prev - 1);
      console.error(error);
    }
  };

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.authorId) {
      setViewedUserId(post.authorId);
      setActiveView('public-profile');
    }
  };

  // Inline post editing content save
  const handleSaveEdit = async () => {
    if (!editContent.trim() || !auth.currentUser) return;
    setIsSavingEdit(true);
    try {
      await updatePostContent(post.id, editContent.trim());
      setIsEditingContent(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete post
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deletePost(post.id);
    } catch (error) {
      console.error("Error al eliminar publicación:", error);
    }
  };

  const loadComments = async () => {
    try {
      const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      setComments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  useEffect(() => {
    if (showComments) loadComments();
  }, [showComments]);

  const handleAddComment = async () => {
    if (!auth.currentUser) {
      setAuthModalOpen(true);
      return;
    }
    if (!newComment.trim() || !user || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const cRef = collection(db, 'posts', post.id, 'comments');
      await addDoc(cRef, {
        authorId: user.uid,
        authorUsername: user.username,
        authorPhoto: user.photoURL || null,
        content: newComment.trim(),
        createdAt: serverTimestamp()
      });
      // also update commentsCount in post
      await updateDoc(doc(db, 'posts', post.id), {
        commentsCount: increment(1),
        updatedAt: serverTimestamp()
      });
      setNewComment("");
      await loadComments();
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentReaction = async (commentId: string, reactionType: 'like' | 'dislike') => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    try {
      await reactToComment(post.id, commentId, reactionType);
      await loadComments();
    } catch (err) {
      console.error("Error toggling comment reaction:", err);
    }
  };

  const handleAddReply = async (commentId: string) => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!replyContent.trim() || isSubmittingReply) return;
    try {
      setIsSubmittingReply(true);
      await replyToComment(post.id, commentId, replyContent);
      setReplyContent('');
      setReplyingToCommentId(null);
      await loadComments();
    } catch (err) {
      console.error("Error adding reply:", err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const isOwner = auth.currentUser?.uid === post.authorId || user?.isAdmin;

  // Dynamically resolve author info from the usersMap to prevent stale views if ANY profile was updated
  const liveAuthor = usersMap?.[post.authorId];
  const displayAuthorPhoto = liveAuthor?.photoURL || post.authorPhoto;
  const displayAuthorUsername = liveAuthor?.username || post.authorUsername;
  const displayAuthorDisplayName = liveAuthor?.displayName || post.authorUsername;

  return (
    <>
      <motion.article 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
      >
        {post.isRepost && (
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono mb-2.5 px-2.5 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full w-fit max-w-full truncate">
            <Repeat2 size={11} className="text-emerald-400" />
            <span>@{displayAuthorUsername} compartió la publicación de @{post.repostedFromUsername || 'usuario'}</span>
          </div>
        )}
        <div className="flex gap-3">
          <img 
            onClick={handleViewProfile}
            src={displayAuthorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} 
            alt={displayAuthorUsername}
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-full bg-zinc-900 border border-white/10 shrink-0 object-cover cursor-pointer hover:border-white/20 transition-all"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5 relative">
              <div className="flex items-center gap-1.5 truncate">
                <span 
                   onClick={handleViewProfile}
                   className="font-bold text-sm text-white hover:underline cursor-pointer"
                >
                  {displayAuthorDisplayName}
                </span>
                <span className="text-[13px] text-zinc-500 font-mono truncate">
                  @{displayAuthorUsername}
                </span>
                <span className="text-zinc-500 text-xs text-nowrap">· {formatDistanceToNow(new Date(post.createdAt?.toDate?.() || post.createdAt), { addSuffix: true, locale: es })}</span>
              </div>
              
              <div className="flex items-center gap-1 relative" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(!isMenuOpen);
                  }}
                  className="text-zinc-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5"
                  title="Opciones"
                >
                  <MoreHorizontal size={14} />
                </button>
                
                {/* Options Dropdown Menu */}
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      className="absolute right-0 top-7 w-36 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl py-1 z-30 font-mono text-[10px] overflow-hidden"
                    >
                      {isOwner && (
                        <>
                          <button 
                            onClick={(e) => {
                              setIsMenuOpen(false);
                              setIsEditingContent(true);
                            }}
                            className="w-full text-left px-3 py-2 text-zinc-200 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Edit3 size={11} className="text-blue-500" />
                            Editar
                          </button>
                          <button 
                            onClick={handleDelete}
                            className="w-full text-left px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Trash size={11} className="text-red-500" />
                            Eliminar
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => {
                          setIsMenuOpen(false);
                          setIsReportOpen(true);
                        }}
                        className="w-full text-left px-3 py-2 text-zinc-200 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <AlertTriangle size={11} className="text-yellow-500" />
                        Denunciar
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            {/* Post Content Display or Editor */}
            {isEditingContent ? (
              <div className="mt-2 space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-blue-500 resize-none font-sans"
                  rows={3}
                />
                <div className="flex justify-end gap-2 text-[10px] font-mono">
                  <button 
                    onClick={() => setIsEditingContent(false)}
                    className="px-2.5 py-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !editContent.trim()}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-full font-bold tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    {isSavingEdit ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words break-all mt-0.5 overflow-hidden">
                {renderTextWithLinks(post.content)}
              </p>
            )}
            
            {/* Click to expand post media attachments */}
            {post.mediaUrl && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMediaZoomed(true);
                }}
                className="mt-3 rounded-lg overflow-hidden border border-white/5 bg-zinc-900/50 cursor-zoom-in hover:brightness-105 transition-all max-h-80"
              >
                {post.mediaType === 'image' ? (
                  <img src={post.mediaUrl} alt="Post content" className="w-full object-cover max-h-80" referrerPolicy="no-referrer" />
                ) : (
                  <video src={post.mediaUrl} className="w-full max-h-80 object-cover" />
                )}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-zinc-500 max-w-sm">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }} 
                className={`flex items-center gap-1.5 text-xs transition-colors ${showComments ? 'text-blue-500' : 'hover:text-blue-400'}`}
              >
                <MessageCircle size={14} className={showComments ? 'fill-blue-500/20' : ''} />
                <span>{post.commentsCount || 0}</span>
              </button>
              <button 
                onClick={handleRetweet}
                className={`flex items-center gap-1.5 text-xs transition-colors ${isRTed ? "text-green-500" : "hover:text-green-400"}`}
              >
                <Repeat2 size={14} className={isRTed ? "scale-110" : ""} />
                <span>{localRTs}</span>
              </button>
              <button 
                onClick={handleLike}
                className={`flex items-center gap-1.5 text-xs transition-colors ${isLiked ? "text-red-500" : "hover:text-red-400"}`}
              >
                <Heart size={14} className={isLiked ? "fill-red-500 text-red-500" : ""} />
                <span>{localLikes}</span>
              </button>
              <button className="flex items-center gap-1.5 text-xs hover:text-blue-400 transition-colors">
                <Share2 size={14} />
              </button>
            </div>

            {/* Comments Section */}
            <AnimatePresence>
              {showComments && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 border-t border-white/5 pt-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex gap-2 mb-4">
                    <img 
                      src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'guest'}`} 
                      className="w-7 h-7 rounded-full object-cover shrink-0" 
                      alt="You" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 flex gap-2">
                      <input 
                        type="text" 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                        placeholder="Escribe un comentario..." 
                        className="flex-1 bg-zinc-900 border border-white/10 rounded-full px-3 py-1 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                        maxLength={200}
                      />
                      <button 
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || isSubmittingComment}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-50"
                      >
                        Enviar
                      </button>
                    </div>
                  </div>
                     <div className="space-y-4">
                    {comments.map((comment, i) => {
                      const liveCommentAuthor = usersMap?.[comment.authorId];
                      const displayCommentPhoto = liveCommentAuthor?.photoURL || comment.authorPhoto;
                      const displayCommentUsername = liveCommentAuthor?.username || comment.authorUsername;
                      return (
                      <div key={comment.id || i} className="flex gap-2.5 items-start">
                        <img 
                          onClick={() => {
                            setViewedUserId(comment.authorId);
                            setActiveView('public-profile');
                          }}
                          src={displayCommentPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorId}`}
                          alt="Commenter"
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full bg-zinc-900 border border-white/10 shrink-0 object-cover cursor-pointer hover:border-white/20 transition-all"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2">
                            <p 
                              className="text-[10px] text-zinc-400 font-mono font-bold cursor-pointer hover:text-zinc-200 uppercase"
                              onClick={() => {
                                setViewedUserId(comment.authorId);
                                setActiveView('public-profile');
                              }}
                            >
                              @{displayCommentUsername}
                            </p>
                            <p className="text-xs text-white mt-0.5 leading-snug break-words">{renderTextWithLinks(comment.content)}</p>
                          </div>
                          
                          {/* Reactions & Reply button bar */}
                          <div className="flex items-center gap-4 mt-1.5 ml-2 text-[10px] text-zinc-500 font-mono">
                            <button 
                              onClick={() => handleCommentReaction(comment.id, 'like')}
                              className={`flex items-center gap-1 hover:text-blue-400 transition-colors ${comment.likedBy?.includes(user?.uid) ? 'text-blue-400 font-bold' : ''}`}
                            >
                              <ThumbsUp size={11} />
                              <span>{comment.likesCount || 0}</span>
                            </button>
                            
                            <button 
                              onClick={() => handleCommentReaction(comment.id, 'dislike')}
                              className={`flex items-center gap-1 hover:text-red-400 transition-colors ${comment.dislikedBy?.includes(user?.uid) ? 'text-red-400 font-bold' : ''}`}
                            >
                              <ThumbsDown size={11} />
                              <span>{comment.dislikesCount || 0}</span>
                            </button>
                            
                            <button 
                              onClick={() => {
                                setReplyingToCommentId(replyingToCommentId === comment.id ? null : comment.id);
                                setReplyContent("");
                              }}
                              className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                            >
                              <Reply size={11} className="scale-x-[-1]" />
                              <span>Responder</span>
                            </button>
                          </div>

                          {/* Reply input field */}
                          {replyingToCommentId === comment.id && (
                            <div className="mt-2 flex gap-1.5 items-center bg-white/5 border border-white/5 rounded-xl p-1.5">
                              <input 
                                type="text"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="Escribe una respuesta..."
                                className="flex-1 bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 px-2 font-sans text-left"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddReply(comment.id);
                                }}
                              />
                              <button 
                                onClick={() => handleAddReply(comment.id)}
                                disabled={!replyContent.trim() || isSubmittingReply}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-mono font-bold uppercase text-[9px] px-2.5 py-1 rounded-lg transition-colors"
                              >
                                {isSubmittingReply ? '...' : 'Responder'}
                              </button>
                            </div>
                          )}

                          {/* Replies list */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="mt-2 pl-4 border-l border-white/5 space-y-2 text-left">
                              {comment.replies.map((reply: any) => {
                                const liveReplyAuthor = usersMap?.[reply.authorId];
                                const displayReplyUsername = liveReplyAuthor?.username || reply.authorUsername;
                                return (
                                <div key={reply.id} className="text-xs bg-white/[0.02] rounded-xl p-2 border border-white/5">
                                  <div className="flex justify-between items-baseline mb-0.5">
                                    <span className="font-bold font-mono text-[9px] text-zinc-400">@{displayReplyUsername}</span>
                                  </div>
                                  <p className="text-zinc-200 text-xs leading-normal">{reply.content}</p>
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })}
                    {comments.length === 0 && (
                      <p className="text-center text-[10px] text-zinc-500 font-mono py-2 uppercase tracking-widest">
                        Sé el primero en comentar
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.article>

      {/* Lightbox full-screen overlays (Lightbox zoom) */}
      <AnimatePresence>
        {isMediaZoomed && post.mediaUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMediaZoomed(false)}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setIsMediaZoomed(false)}
              className="absolute top-6 right-6 p-2 bg-white/5 border border-white/10 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-all"
            >
              <X size={18} />
            </button>
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="max-w-5xl max-h-[85vh] overflow-hidden rounded-xl flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {post.mediaType === 'image' ? (
                <img 
                  src={post.mediaUrl} 
                  alt="Expanded Content" 
                  className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <video 
                  src={post.mediaUrl} 
                  controls 
                  autoPlay
                  className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)]" 
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReportModal 
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetId={post.id}
        targetType="post"
      />
    </>
  );
}
