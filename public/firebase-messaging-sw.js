// Firebase Cloud Messaging Service Worker
// This file handles background push notifications for web

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration
// NOTE: This will be loaded from environment variables in production
const firebaseConfig = {
  apiKey: "AIzaSyBCCp1Hhp4obL15sffYz8pEyZHXij5aUSY",
  authDomain: "barrana-ai-school-project.firebaseapp.com",
  projectId: "barrana-ai-school-project",
  storageBucket: "barrana-ai-school-project.firebasestorage.app",
  messagingSenderId: "37843004037",
  appId: "1:37843004037:web:e29113bf70a272d92157ec"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || 'Barrana.ai School';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon || '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: payload.data?.type || 'notification',
    data: payload.data || {},
    requireInteraction: payload.data?.priority === 'high',
    actions: [
      {
        action: 'view',
        title: 'View'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  if (action === 'dismiss') {
    return;
  }

  // Open app or focus existing window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUnattached: true }).then((clientList) => {
      // Focus existing window if found
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if no existing window found
      if (clients.openWindow) {
        let targetUrl = '/';
        
        // Navigate to specific page based on notification type
        if (notificationData?.reportId) {
          targetUrl = `/reports/${notificationData.reportId}`;
        } else if (notificationData?.action === 'approve_report') {
          targetUrl = '/admin/reports';
        } else if (notificationData?.action === 'create_report') {
          targetUrl = '/teachers';
        }
        
        return clients.openWindow(targetUrl);
      }
    })
  );
});

