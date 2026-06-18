import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc,
  serverTimestamp,
  getDocFromServer,
  doc,
  getDocs,
  where,
  limit,
  updateDoc,
  Timestamp,
  increment,
  deleteDoc,
  getDoc,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { updateProfile as updateFirebaseAuthProfile } from 'firebase/auth';
import { db, auth } from '../firebase';
import { Post, ChatMessage, OperationType, Report, User } from '../types';
import { createRealtimeNotification } from './notificationService';

export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Nexus] Cloud connection verified.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("[Nexus] CRITICAL: System is offline. Check Firebase configuration.");
    } else {
      console.warn("[Nexus] Health check warning:", error instanceof Error ? error.message : String(error));
    }
  }
}

function handleFirestoreError(error: any, operation: OperationType, path: string) {
  const errInfo = {
    error: error.message,
    operationType: operation,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email
    }
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function subscribeToPosts(callback: (posts: Post[]) => void, filters?: { dateRange?: { start: Date, end: Date } }) {
  // Simplificar consulta para asegurar que los posts aparezcan sin problemas de índice complejos al inicio
  let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
  
  if (filters?.dateRange) {
    q = query(q, where('createdAt', '>=', Timestamp.fromDate(filters.dateRange.start)), where('createdAt', '<=', Timestamp.fromDate(filters.dateRange.end)));
  }

  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Post));
    callback(posts);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'posts');
  });
}

export async function startChat(otherUserId: string, otherUserData: any) {
  if (!auth.currentUser) throw new Error('No autenticado');
  
  // Buscar si ya existe un chat entre estos dos
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', auth.currentUser.uid)
  );
  
  const snap = await getDocs(q);
  const existingChat = snap.docs.find(doc => doc.data().participants.includes(otherUserId));
  
  if (existingChat) return existingChat.id;
  
  // Crear nuevo chat
  const chatRef = await addDoc(collection(db, 'chats'), {
    participants: [auth.currentUser.uid, otherUserId],
    participantDetails: [
      {
        uid: auth.currentUser.uid,
        displayName: auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL
      },
      {
        uid: otherUserId,
        displayName: otherUserData.displayName,
        photoURL: otherUserData.photoURL
      }
    ],
    updatedAt: serverTimestamp(),
    lastMessage: 'Handshake initiated',
    lastMessageAt: serverTimestamp()
  });
  
  return chatRef.id;
}

export async function searchContent(searchTerm: string, type: 'posts' | 'users') {
  const term = searchTerm.toLowerCase();
  const path = type === 'posts' ? 'posts' : 'users';
  // Fuzzy search aproximado usando prefijos
  const q = query(
    collection(db, path),
    where(type === 'posts' ? 'content' : 'username', '>=', term),
    where(type === 'posts' ? 'content' : 'username', '<=', term + '\uf8ff'),
    limit(20)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function createPost(content: string, mediaUrl?: string, mediaType?: 'image' | 'video') {
  if (!auth.currentUser) throw new Error('No autenticado');
  
  let authorPhoto = auth.currentUser.photoURL;
  let authorUsername = auth.currentUser.displayName || 'NexusUser';
  
  try {
    const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    if (userSnap.exists()) {
      authorPhoto = userSnap.data().photoURL || authorPhoto;
      authorUsername = userSnap.data().username || authorUsername;
    }
  } catch (e) {
    console.error("No se pudo obtener el perfil del usuario para el post", e);
  }

  const hashtags = content.match(/#[a-z0-9_]+/gi) || [];

  const path = 'posts';
  try {
    const docRef = await addDoc(collection(db, path), {
      authorId: auth.currentUser.uid,
      authorUsername: authorUsername,
      authorPhoto: authorPhoto,
      content,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      likesCount: 0,
      commentsCount: 0,
      hashtags: hashtags.map(h => h.toLowerCase()),
      isRemoved: false,
      createdAt: serverTimestamp()
    });

    // Detect and handle @mentions
    const mentions = content.match(/@([a-zA-Z0-9_]{3,30})/g);
    if (mentions) {
      for (const mention of mentions) {
        const cleanUsername = mention.replace('@', '').toLowerCase().trim();
        const usersQuery = query(collection(db, 'users'), where('username', '==', cleanUsername));
        const userSnap = await getDocs(usersQuery);
        if (!userSnap.empty) {
          const recipientId = userSnap.docs[0].id;
          if (recipientId !== auth.currentUser.uid) {
            await createRealtimeNotification({
              recipientId,
              type: 'mention',
              contentOrTitle: `te mencionó en una publicación: "${content.substring(0, 35)}${content.length > 35 ? '...' : ''}"`,
              postId: docRef.id
            });
          }
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function reportContent(targetId: string, targetType: 'post' | 'user' | 'comment', reason: string, details?: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const path = 'reports';
  try {
    await addDoc(collection(db, path), {
      targetId,
      targetType,
      reporterId: auth.currentUser.uid,
      reason,
      details: details || '',
      status: 'pending',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveUser(firebaseUser: any) {
  if (!firebaseUser) return;
  const userRef = doc(db, 'users', firebaseUser.uid);
  try {
    const snap = await getDocFromServer(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || 'Usuario',
        photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
        username: firebaseUser.displayName?.toLowerCase().replace(/\s/g, '').slice(0, 15) || `user_${firebaseUser.uid.slice(0, 5)}`,
        bio: "¡Hola! Acabo de unirme a la red.",
        followersCount: 0,
        followingCount: 0,
        isAdmin: false,
        isBanned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error("[Nexus] Error during user sync:", error);
  }
}

export async function likePost(postId: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const postRef = doc(db, 'posts', postId);
  try {
    await updateDoc(postRef, { 
      likesCount: increment(1),
      likedBy: arrayUnion(auth.currentUser.uid),
      updatedAt: serverTimestamp()
    });

    // Send dynamic realtime notification to post author
    const postSnap = await getDocFromServer(postRef);
    if (postSnap.exists()) {
      const postData = postSnap.data();
      if (postData.authorId && postData.authorId !== auth.currentUser.uid) {
        await createRealtimeNotification({
          recipientId: postData.authorId,
          type: 'like',
          contentOrTitle: `le dio me gusta a tu publicación: "${postData.content.substring(0, 30)}${postData.content.length > 30 ? '...' : ''}"`,
          postId
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
  }
}

export async function unlikePost(postId: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const postRef = doc(db, 'posts', postId);
  try {
    await updateDoc(postRef, { 
      likesCount: increment(-1),
      likedBy: arrayRemove(auth.currentUser.uid),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
  }
}

export async function retweetPost(postId: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const postRef = doc(db, 'posts', postId);
  try {
    await updateDoc(postRef, { 
      retweetsCount: increment(1),
      retweetedBy: arrayUnion(auth.currentUser.uid),
      updatedAt: serverTimestamp()
    });

    const postSnap = await getDocFromServer(postRef);
    if (postSnap.exists()) {
      const orig = postSnap.data();
      await addDoc(collection(db, 'posts'), {
        authorId: auth.currentUser.uid,
        authorUsername: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'NexusUser',
        authorPhoto: auth.currentUser.photoURL,
        content: orig.content,
        mediaUrl: orig.mediaUrl || null,
        mediaType: orig.mediaType || null,
        likesCount: 0,
        retweetsCount: 0,
        commentsCount: 0,
        isRemoved: false,
        createdAt: serverTimestamp(),
        isRepost: true,
        repostedFromId: orig.authorId,
        repostedFromUsername: orig.authorUsername || 'usuario',
        originalPostId: postId
      });

      if (orig.authorId && orig.authorId !== auth.currentUser.uid) {
        await createRealtimeNotification({
          recipientId: orig.authorId,
          type: 'mention',
          contentOrTitle: `republicó tu publicación: "${orig.content.substring(0, 30)}${orig.content.length > 30 ? '...' : ''}"`,
          postId
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
  }
}

export async function unretweetPost(postId: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const postRef = doc(db, 'posts', postId);
  try {
    await updateDoc(postRef, { 
      retweetsCount: increment(-1),
      retweetedBy: arrayRemove(auth.currentUser.uid),
      updatedAt: serverTimestamp()
    });

    const q = query(
      collection(db, 'posts'),
      where('authorId', '==', auth.currentUser.uid),
      where('originalPostId', '==', postId),
      where('isRepost', '==', true)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, 'posts', d.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
  }
}

export function subscribeToMessages(chatId: string, callback: (messages: ChatMessage[]) => void, retryCount = 0): () => void {
  const path = `chats/${chatId}/messages`;
  const q = query(collection(db, path), orderBy('createdAt', 'asc'));
  
  let unsubscribe: () => void = () => {};
  let isUnsubscribed = false;

  try {
    unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatMessage));
      callback(messages);
    }, (error) => {
      if (!isUnsubscribed && error.code === 'permission-denied' && retryCount < 3) {
        console.warn(`[Nexus] Retrying message subscription in 1s for chat ${chatId} (attempt ${retryCount + 1})...`);
        setTimeout(() => {
          if (!isUnsubscribed) {
            unsubscribe = subscribeToMessages(chatId, callback, retryCount + 1);
          }
        }, 1000);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    });
  } catch (err) {
    console.error('[Nexus] Exception in subscribeToMessages:', err);
  }

  return () => {
    isUnsubscribed = true;
    unsubscribe();
  };
}

export function subscribeToChats(callback: (chats: any[]) => void, retryCount = 0): () => void {
  if (!auth.currentUser) return () => {};
  
  const q = query(
    collection(db, 'chats'), 
    where('participants', 'array-contains', auth.currentUser.uid)
  );
  
  let unsubscribe: () => void = () => {};
  let isUnsubscribed = false;

  try {
    unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => {
        const timeA = a.updatedAt?.toMillis() || 0;
        const timeB = b.updatedAt?.toMillis() || 0;
        return timeB - timeA;
      });
      callback(chats);
    }, (error) => {
      if (!isUnsubscribed && error.code === 'permission-denied' && retryCount < 3) {
        console.warn(`[Nexus] Retrying chats subscription in 1s (attempt ${retryCount + 1})...`);
        setTimeout(() => {
          if (!isUnsubscribed) {
            unsubscribe = subscribeToChats(callback, retryCount + 1);
          }
        }, 1000);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      }
    });
  } catch (err) {
    console.error('[Nexus] Exception in subscribeToChats:', err);
  }

  return () => {
    isUnsubscribed = true;
    unsubscribe();
  };
}

export async function updateProfile(data: { displayName?: string, username?: string, bio?: string, photoURL?: string }) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const uid = auth.currentUser.uid;
  const userRef = doc(db, 'users', uid);
  try {
    const batch = writeBatch(db);
    batch.update(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });

    if (data.photoURL || data.displayName || data.username) {
      const q = query(collection(db, 'posts'), where('authorId', '==', uid));
      const snap = await getDocs(q);
      snap.docs.forEach(docSnap => {
        const updateData: any = {};
        if (data.photoURL) updateData.authorPhoto = data.photoURL;
        if (data.displayName || data.username) updateData.authorUsername = data.displayName || data.username;
        batch.update(docSnap.ref, updateData);
      });
      // Update the underlying Auth object so subsequent creates use the immediate new value
      try {
        await updateFirebaseAuthProfile(auth.currentUser, {
          displayName: data.displayName || auth.currentUser.displayName,
          photoURL: data.photoURL || auth.currentUser.photoURL
        });
      } catch (authError) {
        console.warn('Could not update Firebase Auth profile (possibly photoURL too long), falling back to just Firestore:', authError);
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateNotificationSettings(settings: any) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const userRef = doc(db, 'users', auth.currentUser.uid);
  try {
    await updateDoc(userRef, {
      notificationSettings: settings,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
  }
}

export async function getAllUsers() {
  if (!auth.currentUser) return [];
  try {
    const q = query(collection(db, 'users'), limit(50));
    const snap = await getDocs(q);
    return snap.docs
      .map(doc => ({ uid: doc.id, ...doc.data() } as User))
      .filter(u => u.uid !== auth.currentUser?.uid);
  } catch (error) {
    console.error("[Nexus] Error loading users list:", error);
    return [];
  }
}

export async function setOnlineStatus(uid: string, isOnline: boolean) {
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      isOnline,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    // Si falla por alguna razón (ej. no existe aún el documento), ignoramos
  }
}

export function isUserOnline(userData: any): boolean {
  if (!userData) return false;
  if (userData.isOnline !== true) return false;
  if (!userData.lastSeen) return true; // fallback if no lastSeen field
  
  let lastSeenMs = 0;
  if (typeof userData.lastSeen.toMillis === 'function') {
    lastSeenMs = userData.lastSeen.toMillis();
  } else if (userData.lastSeen.seconds) {
    lastSeenMs = userData.lastSeen.seconds * 1000;
  } else if (userData.lastSeen.toDate && typeof userData.lastSeen.toDate === 'function') {
    lastSeenMs = userData.lastSeen.toDate().getTime();
  } else {
    lastSeenMs = new Date(userData.lastSeen).getTime();
  }
  
  if (isNaN(lastSeenMs) || lastSeenMs === 0) return true;
  
  // If heartbeat is older than 3 minutes, they are offline
  const diffMinutes = (Date.now() - lastSeenMs) / 1000 / 60;
  return diffMinutes < 3;
}

export async function sendMessage(chatId: string, text: string, mediaUrl?: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  
  const path = `chats/${chatId}/messages`;
  try {
    await addDoc(collection(db, path), {
      chatId,
      senderId: auth.currentUser.uid,
      text,
      mediaUrl: mediaUrl || null,
      createdAt: serverTimestamp()
    });
    
    // Actualizar el timestamp del chat para que suba en la lista
    await setDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Send direct message notification to the other participant
    try {
      const chatSnap = await getDocFromServer(doc(db, 'chats', chatId));
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const participants = chatData.participants || [];
        const otherUserId = participants.find((uid: string) => uid !== auth.currentUser?.uid);
        if (otherUserId) {
          await createRealtimeNotification({
            recipientId: otherUserId,
            type: 'message',
            contentOrTitle: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
            chatId
          });
        }
      }
    } catch (e) {
      console.error('[FCM] Error generating message notification:', e);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function followUser(followingId: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const followerId = auth.currentUser.uid;
  if (followerId === followingId) throw new Error('No puedes seguirte a ti mismo');

  const followRef = doc(db, 'follows', `${followerId}_${followingId}`);
  try {
    const batch = writeBatch(db);
    batch.set(followRef, {
      followerId,
      followingId,
      createdAt: serverTimestamp()
    });

    const meRef = doc(db, 'users', followerId);
    batch.update(meRef, {
      followingCount: increment(1),
      updatedAt: serverTimestamp()
    });

    const otherRef = doc(db, 'users', followingId);
    batch.update(otherRef, {
      followersCount: increment(1),
      updatedAt: serverTimestamp()
    });

    await batch.commit();

    await createRealtimeNotification({
      recipientId: followingId,
      type: 'mention',
      contentOrTitle: `comenzó a seguirte`,
      postId: ''
    });

  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `follows/${followerId}_${followingId}`);
  }
}

export async function unfollowUser(followingId: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const followerId = auth.currentUser.uid;

  const followRef = doc(db, 'follows', `${followerId}_${followingId}`);
  try {
    const batch = writeBatch(db);
    batch.delete(followRef);

    const meRef = doc(db, 'users', followerId);
    batch.update(meRef, {
      followingCount: increment(-1),
      updatedAt: serverTimestamp()
    });

    const otherRef = doc(db, 'users', followingId);
    batch.update(otherRef, {
      followersCount: increment(-1),
      updatedAt: serverTimestamp()
    });
    
    await batch.commit();

  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `follows/${followerId}_${followingId}`);
  }
}

export async function isFollowingUser(followingId: string): Promise<boolean> {
  if (!auth.currentUser) return false;
  const followerId = auth.currentUser.uid;
  const followRef = doc(db, 'follows', `${followerId}_${followingId}`);
  try {
    const snap = await getDoc(followRef);
    return snap.exists();
  } catch (error) {
    return false;
  }
}

export async function getUserFollowers(userId: string): Promise<User[]> {
  try {
    const q = query(collection(db, 'follows'), where('followingId', '==', userId));
    const snap = await getDocs(q);
    const followerIds = snap.docs.map(d => d.data().followerId);
    
    if (followerIds.length === 0) return [];
    
    const users: User[] = [];
    for (const dId of followerIds) {
      const uRef = doc(db, 'users', dId);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        users.push({ id: uSnap.id, uid: uSnap.id, ...uSnap.data() } as unknown as User);
      }
    }
    return users;
  } catch(error) {
    console.error(error);
    return [];
  }
}

export async function getUserFollowing(userId: string): Promise<User[]> {
  try {
    const q = query(collection(db, 'follows'), where('followerId', '==', userId));
    const snap = await getDocs(q);
    const followingIds = snap.docs.map(d => d.data().followingId);
    
    if (followingIds.length === 0) return [];
    
    const users: User[] = [];
    for (const dId of followingIds) {
      const uRef = doc(db, 'users', dId);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        users.push({ id: uSnap.id, uid: uSnap.id, ...uSnap.data() } as unknown as User);
      }
    }
    return users;
  } catch(error) {
    console.error(error);
    return [];
  }
}

export async function deletePost(postId: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const postRef = doc(db, 'posts', postId);
  try {
    await deleteDoc(postRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
  }
}

export async function updatePostContent(postId: string, newContent: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const postRef = doc(db, 'posts', postId);
  try {
    await updateDoc(postRef, {
      content: newContent,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `posts/${postId}`);
  }
}

export async function reactToComment(postId: string, commentId: string, reactionType: 'like' | 'dislike') {
  if (!auth.currentUser) throw new Error('No autenticado');
  const userId = auth.currentUser.uid;
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  
  try {
    const snap = await getDoc(commentRef);
    if (!snap.exists()) return;
    const data = snap.data();
    
    let likedBy = data.likedBy || [];
    let dislikedBy = data.dislikedBy || [];
    let likesCount = data.likesCount || 0;
    let dislikesCount = data.dislikesCount || 0;
    
    const hasLiked = likedBy.includes(userId);
    const hasDisliked = dislikedBy.includes(userId);
    
    if (reactionType === 'like') {
      if (hasLiked) {
        likedBy = likedBy.filter((id: string) => id !== userId);
        likesCount = Math.max(0, likesCount - 1);
      } else {
        likedBy.push(userId);
        likesCount += 1;
        if (hasDisliked) {
          dislikedBy = dislikedBy.filter((id: string) => id !== userId);
          dislikesCount = Math.max(0, dislikesCount - 1);
        }
      }
    } else if (reactionType === 'dislike') {
      if (hasDisliked) {
        dislikedBy = dislikedBy.filter((id: string) => id !== userId);
        dislikesCount = Math.max(0, dislikesCount - 1);
      } else {
        dislikedBy.push(userId);
        dislikesCount += 1;
        if (hasLiked) {
          likedBy = likedBy.filter((id: string) => id !== userId);
          likesCount = Math.max(0, likesCount - 1);
        }
      }
    }
    
    await updateDoc(commentRef, {
      likedBy,
      dislikedBy,
      likesCount,
      dislikesCount,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error reacting to comment:", error);
    throw error;
  }
}

export async function replyToComment(postId: string, commentId: string, content: string) {
  if (!auth.currentUser) throw new Error('No autenticado');
  const user = auth.currentUser;
  
  const userDocRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userDocRef);
  let username = 'usuario';
  if (userSnap.exists()) {
    username = userSnap.data().username || 'usuario';
  }

  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  const replyObj = {
    id: Math.random().toString(36).substring(2, 9),
    authorId: user.uid,
    authorUsername: username,
    content: content.trim(),
    createdAt: new Date().toISOString()
  };

  try {
    const snap = await getDoc(commentRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const replies = data.replies || [];
    replies.push(replyObj);
    
    await updateDoc(commentRef, {
      replies
    });
  } catch (error) {
    console.error("Error replying to comment:", error);
    throw error;
  }
}
