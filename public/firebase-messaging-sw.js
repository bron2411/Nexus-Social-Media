// Firebase Cloud Messaging Background Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker with the config values.
firebase.initializeApp({
  apiKey: "AIzaSyDjduATztbJVQxdBNybBwaEsUZ6mX0Mdtk",
  authDomain: "nexus-8970d.firebaseapp.com",
  projectId: "nexus-8970d",
  storageBucket: "nexus-8970d.firebasestorage.app",
  messagingSenderId: "212258788925",
  appId: "1:212258788925:web:fbcbe44024a274d9077c54",
  measurementId: "G-WL1JZRXFFX"
});

// Retrieve an instance of Firebase Cloud Messaging.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Nexus Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Nueva actualización en el clúster.',
    icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
    tag: payload.data?.chatId || payload.data?.postId || 'nexus-general',
    data: {
      url: payload.data?.chatId ? `/messages?chatId=${payload.data.chatId}` : '/'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to open links
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab/window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
