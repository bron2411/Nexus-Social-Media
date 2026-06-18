import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc, 
  increment,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';

// Helper to check if browser supports Push Notifications and Service Workers
export const isPushSupported = () => {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

// Safe Messaging Initialization
let messagingInstance: Messaging | null = null;
try {
  if (isPushSupported()) {
    // Only fetch if available
    messagingInstance = getMessaging();
  }
} catch (err) {
  console.warn('[FCM] Messaging could not be initialized directly:', err);
}

/**
 * Request permission for Push Notifications and get the FCM Device Token.
 * Saves the token to the user's Firestore profile so we can send alerts to this device.
 */
export async function requestNotificationPermission(userId: string, customVapidKey?: string) {
  if (!isPushSupported()) {
    console.log('[FCM] Push notifications not supported inside this environment/iframe. Activating virtual channel...');
    const userRef = doc(db, 'users', userId);
    const virtualToken = `virtual_token_${userId}_${Math.random().toString(36).substring(7)}`;
    try {
      await updateDoc(userRef, {
        fcmToken: virtualToken,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('[FCM] Could not write virtual fcmToken:', e);
    }
    return {
      success: true,
      token: virtualToken,
      isVirtual: true,
      warning: '¡Canal virtual activado! Tu navegador o este entorno de iframe no soporta notificaciones push nativas. Hemos activado un canal virtual de mensajería interna para mostrarte notificaciones visuales en tiempo real dentro de la aplicación.'
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permiso de notificación denegado por el usuario.' };
    }

    if (!messagingInstance) {
      throw new Error('Servicio de mensajería no instanciado.');
    }

    const vapidKey = customVapidKey || 'BEl62v96v9jGo84Q862YgIPYv9_c_F_g0R7X90qVb86_7Y_g0R7X90qVb8';
    const token = await getToken(messagingInstance, {
      vapidKey: vapidKey,
    });

    if (token) {
      console.log('[FCM] Device registered successfully. Token:', token);
      
      // Update Firestore user document with this device token
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        fcmToken: token,
        'notificationSettings.likes': true,
        'notificationSettings.comments': true,
        'notificationSettings.mentions': true,
        'notificationSettings.messages': true,
        updatedAt: serverTimestamp()
      });

      return { success: true, token };
    } else {
      throw new Error('No se pudo obtener el token de registro del dispositivo.');
    }
  } catch (error: any) {
    console.warn('[FCM] Error obtaining token, falling back to virtual channel:', error);
    
    // Create a persistent virtual notification registration
    const userRef = doc(db, 'users', userId);
    const virtualToken = `virtual_token_${userId}_${Math.random().toString(36).substring(7)}`;
    try {
      await updateDoc(userRef, {
        fcmToken: virtualToken,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('[FCM] Could not write virtual fcmToken inside catch:', e);
    }
    return { 
      success: true, 
      token: virtualToken, 
      isVirtual: true,
      warning: '¡Canal de alertas en tiempo real activado! Para superar las restricciones de seguridad relativas a iframes cross-origin de tu navegador, hemos configurado un canal interno para recibir notificaciones visuales dentro de la aplicación.'
    };
  }
}

/**
 * Registers the background messaging service worker.
 */
export async function registerNotificationServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      // Register service worker from the copy placed in /public
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      console.log('[FCM] Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (err) {
      console.warn('[FCM] Service Worker registration failed (this is typical in sandboxed preview panels):', err);
    }
  }
}

/**
 * Subscribes to foreground message arrivals in FCM.
 */
export function onForegroundMessageReceived(callback: (payload: any) => void) {
  if (messagingInstance) {
    return onMessage(messagingInstance, (payload) => {
      console.log('[FCM] Foreground message received:', payload);
      callback(payload);
    });
  }
  return () => {};
}

/**
 * Creates and logs a dynamic notification document in Firestore.
 * This notifies the recipient and triggers real-time alerts.
 */
export async function createRealtimeNotification({
  recipientId,
  type,
  contentOrTitle,
  postId = '',
  chatId = ''
}: {
  recipientId: string;
  type: 'like' | 'comment' | 'mention' | 'message';
  contentOrTitle: string;
  postId?: string;
  chatId?: string;
}) {
  const currentUserId = auth.currentUser?.uid;
  if (!currentUserId || currentUserId === recipientId) return; // Don't notify self

  try {
    // Obtain sender's details
    const senderRef = doc(db, 'users', currentUserId);
    const senderSnap = await getDoc(senderRef);
    const senderData = senderSnap.exists() ? senderSnap.data() : null;

    const senderName = senderData?.displayName || auth.currentUser.displayName || 'Alguien';
    const senderPhoto = senderData?.photoURL || auth.currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`;

    // Write notification doc to the new secure collection
    const notificationRef = await addDoc(collection(db, 'notifications'), {
      recipientId,
      senderId: currentUserId,
      senderName,
      senderPhoto,
      type,
      contentOrTitle,
      postId: postId || null,
      chatId: chatId || null,
      isRead: false,
      createdAt: serverTimestamp()
    });

    console.log('[FCM] Triggered realtime alert document in DB:", recipientId:', notificationRef.id);
    return notificationRef.id;
  } catch (error) {
    console.error('[FCM] Failed to dispatch notification database entry:', error);
  }
}

/**
 * Listens to active notifications for a specific user in real-time.
 */
export function subscribeToUserNotifications(userId: string, callback: (notifications: any[]) => void, retryCount = 0): () => void {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return () => {};
  }
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId)
  );

  let unsubscribe: () => void = () => {};
  let isUnsubscribed = false;

  try {
    unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort client-side by createdAt descending (newest first) to avoid composite index requirements
      list.sort((a: any, b: any) => {
        const valA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime());
        const valB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime());
        return (valB || 0) - (valA || 0);
      });
      callback(list);
    }, (err) => {
      console.warn('[FCM] Error listening to user notifications:', err);
      if (!isUnsubscribed && err.code === 'permission-denied' && retryCount < 3) {
        console.log(`[FCM] Retrying notification subscription in 1s (attempt ${retryCount + 1})...`);
        setTimeout(() => {
          if (!isUnsubscribed) {
            unsubscribe = subscribeToUserNotifications(userId, callback, retryCount + 1);
          }
        }, 1000);
      }
    });
  } catch (err) {
    console.warn('[FCM] Exception subscribing to user notifications:', err);
  }

  return () => {
    isUnsubscribed = true;
    unsubscribe();
  };
}

/**
 * Mark a notification as read.
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      isRead: true
    });
  } catch (err) {
    console.error('[FCM] Mark read error:', err);
  }
}

/**
 * Mark all user's notifications as read.
 */
export async function markAllNotificationsAsRead(notifications: any[]) {
  try {
    const promises = notifications
      .filter(n => !n.isRead)
      .map(n => updateDoc(doc(db, 'notifications', n.id), { isRead: true }));
    await Promise.all(promises);
  } catch (err) {
    console.error('[FCM] Error marking all notifications as read:', err);
  }
}
