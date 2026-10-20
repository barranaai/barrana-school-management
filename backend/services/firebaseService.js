const admin = require('firebase-admin');
const { logger, safeError } = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
let firebaseApp = null;

const initializeFirebase = () => {
  try {
    // Check if Firebase credentials are configured
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                               path.join(__dirname, '../config/firebase-service-account.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      logger.warn('Firebase service account not found. Push notifications disabled.');
      logger.warn('To enable push notifications:');
      logger.warn('1. Download service account JSON from Firebase Console');
      logger.warn('2. Place it at backend/config/firebase-service-account.json');
      logger.warn('3. Or set FIREBASE_SERVICE_ACCOUNT_PATH env variable');
      return null;
    }

    const serviceAccount = require(serviceAccountPath);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });

    logger.info('Firebase Admin SDK initialized successfully');

    return firebaseApp;
  } catch (error) {
    logger.error('Firebase initialization failed', safeError(error, 'FIREBASE_INITIALIZATION_FAILED'));
    logger.warn('Push notifications will be disabled');
    return null;
  }
};

// Initialize on module load
firebaseApp = initializeFirebase();

/**
 * Send push notification to a single device
 * @param {string} token - FCM token
 * @param {Object} notification - Notification payload
 * @param {Object} data - Data payload
 * @returns {Promise<Object>} Result with success status
 */
const sendNotification = async (token, notification, data = {}) => {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized. Skipping push notification.');
      return { success: false, reason: 'firebase_not_initialized' };
    }

    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.message || notification.body,
        ...(notification.imageUrl && { image: notification.imageUrl })
      },
      data: {
        ...data,
        type: notification.type || 'general',
        timestamp: new Date().toISOString(),
        click_action: notification.clickAction || 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: notification.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true
          }
        }
      },
      webpush: {
        notification: {
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          requireInteraction: notification.priority === 'high'
        }
      }
    };

    const response = await admin.messaging().send(message);
    
    logger.info('Push notification sent successfully', {
      messageId: response,
      title: notification.title
    });

    return { success: true, messageId: response };
  } catch (error) {
    logger.error('Error sending push notification:', {
      error: error.message,
      code: error.code,
      token: token ? `${token.substring(0, 20)}...` : 'none'
    });

    // Handle specific error codes
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return { success: false, reason: 'invalid_token', shouldRemove: true };
    }

    return { success: false, reason: error.code || 'unknown_error' };
  }
};

/**
 * Send push notification to multiple devices
 * @param {Array<string>} tokens - Array of FCM tokens
 * @param {Object} notification - Notification payload
 * @param {Object} data - Data payload
 * @returns {Promise<Object>} Results with success/failure counts
 */
const sendMultipleNotifications = async (tokens, notification, data = {}) => {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized. Skipping push notifications.');
      return { success: false, reason: 'firebase_not_initialized' };
    }

    if (!tokens || tokens.length === 0) {
      return { success: true, successCount: 0, failureCount: 0 };
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.message || notification.body,
        ...(notification.imageUrl && { image: notification.imageUrl })
      },
      data: {
        ...data,
        type: notification.type || 'general',
        timestamp: new Date().toISOString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      ...message
    });

    logger.info('Batch push notifications sent', {
      successCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: tokens.length
    });

    // Collect invalid tokens for cleanup
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && 
          (resp.error.code === 'messaging/invalid-registration-token' ||
           resp.error.code === 'messaging/registration-token-not-registered')) {
        invalidTokens.push(tokens[idx]);
      }
    });

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens
    };
  } catch (error) {
    logger.error('Batch push delivery failed', safeError(error, 'BATCH_PUSH_FAILED'));
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to a user (all their devices)
 * @param {Object} user - User object with fcmTokens array
 * @param {Object} notification - Notification payload
 * @param {Object} data - Data payload
 * @returns {Promise<Object>} Result
 */
const sendNotificationToUser = async (user, notification, data = {}) => {
  try {
    if (!user.fcmTokens || user.fcmTokens.length === 0) {
    logger.info('Push notification skipped because the recipient has no registered device');
      return { success: true, skipped: true, reason: 'no_tokens' };
    }

    const tokens = user.fcmTokens.map(t => t.token);
    const result = await sendMultipleNotifications(tokens, notification, data);

    // Remove invalid tokens from user
    if (result.invalidTokens && result.invalidTokens.length > 0) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(user._id, {
        $pull: { fcmTokens: { token: { $in: result.invalidTokens } } }
      });
    logger.info('Invalid push tokens removed', { count: result.invalidTokens.length });
    }

    return result;
  } catch (error) {
    logger.error('Push notification delivery failed', safeError(error, 'PUSH_DELIVERY_FAILED'));
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to multiple users
 * @param {Array} users - Array of user objects
 * @param {Object} notification - Notification payload
 * @param {Object} data - Data payload
 * @returns {Promise<Object>} Aggregated results
 */
const sendNotificationToUsers = async (users, notification, data = {}) => {
  try {
    const results = await Promise.all(
      users.map(user => sendNotificationToUser(user, notification, data))
    );

    const successCount = results.filter(r => r.success && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info('Batch notifications sent to users', {
      totalUsers: users.length,
      successCount,
      skippedCount,
      failureCount
    });

    return {
      success: true,
      totalUsers: users.length,
      successCount,
      skippedCount,
      failureCount
    };
  } catch (error) {
    logger.error('User push delivery failed', safeError(error, 'PUSH_DELIVERY_FAILED'));
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe a token to a topic (for group notifications)
 * @param {string} token - FCM token
 * @param {string} topic - Topic name
 * @returns {Promise<Object>} Result
 */
const subscribeToTopic = async (token, topic) => {
  try {
    if (!firebaseApp) {
      return { success: false, reason: 'firebase_not_initialized' };
    }

    await admin.messaging().subscribeToTopic(token, topic);
    logger.info(`Token subscribed to topic: ${topic}`);
    return { success: true };
  } catch (error) {
    logger.error('Push topic subscription failed', safeError(error, 'PUSH_TOPIC_SUBSCRIBE_FAILED'));
    return { success: false, error: error.message };
  }
};

/**
 * Unsubscribe a token from a topic
 * @param {string} token - FCM token
 * @param {string} topic - Topic name
 * @returns {Promise<Object>} Result
 */
const unsubscribeFromTopic = async (token, topic) => {
  try {
    if (!firebaseApp) {
      return { success: false, reason: 'firebase_not_initialized' };
    }

    await admin.messaging().unsubscribeFromTopic(token, topic);
    logger.info(`Token unsubscribed from topic: ${topic}`);
    return { success: true };
  } catch (error) {
    logger.error('Push topic unsubscription failed', safeError(error, 'PUSH_TOPIC_UNSUBSCRIBE_FAILED'));
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to a topic (broadcast to all subscribed devices)
 * @param {string} topic - Topic name
 * @param {Object} notification - Notification payload
 * @param {Object} data - Data payload
 * @returns {Promise<Object>} Result
 */
const sendTopicNotification = async (topic, notification, data = {}) => {
  try {
    if (!firebaseApp) {
      return { success: false, reason: 'firebase_not_initialized' };
    }

    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.message || notification.body
      },
      data: {
        ...data,
        type: notification.type || 'general',
        timestamp: new Date().toISOString()
      }
    };

    const response = await admin.messaging().send(message);
    logger.info('Push topic notification accepted', { channel: 'push', status: 'accepted' });
    return { success: true, messageId: response };
  } catch (error) {
    logger.error('Push topic notification failed', safeError(error, 'PUSH_TOPIC_DELIVERY_FAILED'));
    return { success: false, error: error.message };
  }
};

/**
 * Check if Firebase is initialized
 * @returns {boolean} True if Firebase is ready
 */
const isFirebaseInitialized = () => {
  return firebaseApp !== null;
};

module.exports = {
  sendNotification,
  sendMultipleNotifications,
  sendNotificationToUser,
  sendNotificationToUsers,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendTopicNotification,
  isFirebaseInitialized
};

