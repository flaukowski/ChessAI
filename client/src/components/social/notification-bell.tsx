/**
 * Notification Bell Component
 * Display unread notifications with dropdown menu
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Music,
  Loader2,
  Check,
  CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'recording';

interface NotificationUser {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    recordingId?: string;
    recordingTitle?: string;
    commentId?: string;
    userId?: string;
  };
  actor?: NotificationUser;
}

interface NotificationBellProps {
  className?: string;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationBell({
  className,
  onNotificationClick
}: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/social/notifications');

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await fetch(`/api/v1/social/notifications/${notificationId}/read`, {
        method: 'POST',
      });

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    setMarkingAllRead(true);

    try {
      await fetch('/api/v1/social/notifications/read-all', {
        method: 'POST',
      });

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setMarkingAllRead(false);
    }
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
    onNotificationClick?.(notification);
    setIsOpen(false);
  };

  const getNotificationIcon = (type: NotificationType) => {
    const iconClasses = "w-4 h-4";
    switch (type) {
      case 'like':
        return <Heart className={cn(iconClasses, "text-red-500")} />;
      case 'comment':
        return <MessageCircle className={cn(iconClasses, "text-blue-500")} />;
      case 'follow':
        return <UserPlus className={cn(iconClasses, "text-green-500")} />;
      case 'mention':
        return <MessageCircle className={cn(iconClasses, "text-purple-500")} />;
      case 'recording':
        return <Music className={cn(iconClasses, "text-cyan-500")} />;
      default:
        return <Bell className={iconClasses} />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
        >
          <Bell className="w-5 h-5" />

          {/* Unread badge */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1"
              >
                <Badge
                  variant="destructive"
                  className="h-5 min-w-[20px] px-1.5 text-xs flex items-center justify-center"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
            >
              {markingAllRead ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <CheckCheck className="w-3 h-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y">
              <AnimatePresence initial={false}>
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className={cn(
                      "flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-muted/50",
                      !notification.isRead && "bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Actor avatar or icon */}
                    {notification.actor ? (
                      <Avatar
                        src={notification.actor.avatarUrl}
                        alt={notification.actor.username}
                        fallback={notification.actor.username}
                        size="sm"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm",
                        !notification.isRead && "font-medium"
                      )}>
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(notification.createdAt)}
                        </span>
                        {notification.data?.recordingTitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            on "{notification.data.recordingTitle}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {!notification.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                className="w-full h-9 text-sm"
                onClick={() => {
                  // Navigate to full notifications page
                  setIsOpen(false);
                }}
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
