import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Notifications,
  NotificationsActive,
  CheckCircle,
  Schedule,
  Assessment,
  Close,
  ReportProblem,
} from '@mui/icons-material';
import notificationService, { type Notification } from '../../services/notificationService';
import messagingService from '../../services/messagingService';
import toast from 'react-hot-toast';

interface NotificationIconProps {
  variant?: 'default' | 'active';
}

const NotificationIcon: React.FC<NotificationIconProps> = ({ variant = 'default' }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const open = Boolean(anchorEl);

  useEffect(() => {
    loadNotifications();
    
    // Connect to Socket.io for real-time notifications
    const token = localStorage.getItem('token');
    if (token) {
      messagingService.connect(token);

      // Listen for real-time notifications
      const handleNotification = (notification: Notification) => {
        console.log('📡 Real-time notification received:', notification);
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        
        // Show toast notification
        toast.success(notification.message, {
          icon: '🔔',
          duration: 5000,
        });
      };

      // Add listener (check if messagingService has a method to listen for notifications)
      const socket = messagingService.getSocket?.();
      if (socket) {
        socket.on('notification', handleNotification);
      }

      // Cleanup on unmount
      return () => {
        if (socket) {
          socket.off('notification', handleNotification);
        }
      };
    }
    
    // Fallback: Refresh notifications every 30 seconds (if Socket.io fails)
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationService.getNotifications();
      if (response.success) {
        setNotifications(response.data);
        setUnreadCount(notificationService.getUnreadCount(response.data));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setRefreshing(true);
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    } finally {
      setRefreshing(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'report_approval':
        return <Assessment fontSize="small" />;
      case 'due_report':
        return <Schedule fontSize="small" />;
      case 'incident':
      case 'alert':
        return <ReportProblem fontSize="small" />;
      default:
        return <Notifications fontSize="small" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'report_approval':
        return 'primary';
      case 'due_report':
        return 'warning';
      case 'incident':
      case 'alert':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <>
      <IconButton 
        onClick={handleClick}
        sx={{ color: 'text.secondary' }}
        disabled={loading}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {variant === 'active' ? <NotificationsActive /> : <Notifications />}
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500,
            mt: 1,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Notifications
            </Typography>
            {unreadCount > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllAsRead}
                disabled={refreshing}
                startIcon={refreshing ? <CircularProgress size={16} /> : <CheckCircle />}
                sx={{ fontSize: '0.75rem' }}
              >
                Mark all read
              </Button>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {unreadCount} unread • {notifications.length} total
          </Typography>
        </Box>

        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Notifications sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications
              </Typography>
            </Box>
          ) : (
            notifications.map((notification) => (
              <MenuItem
                key={notification.id}
                onClick={() => handleMarkAsRead(notification.id)}
                sx={{
                  display: 'block',
                  p: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: notification.isRead ? 'transparent' : 'rgba(25, 118, 210, 0.05)',
                  '&:hover': {
                    backgroundColor: notification.isRead ? 'rgba(0,0,0,0.04)' : 'rgba(25, 118, 210, 0.1)',
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{ mt: 0.5 }}>
                    {getNotificationIcon(notification.type)}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                        {notification.title}
                      </Typography>
                      {!notification.isRead && (
                        <Chip
                          label="New"
                          size="small"
                          color="primary"
                          sx={{ height: 16, fontSize: '0.6rem' }}
                        />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {notificationService.formatNotificationTime(notification.createdAt)}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))
          )}
        </Box>

        {notifications.length > 0 && (
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleClose}
            >
              Close
            </Button>
          </Box>
        )}
      </Menu>
    </>
  );
};

export default NotificationIcon;
