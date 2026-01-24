/**
 * Follow Button Component
 * Toggle follow/unfollow for users with animated state transitions
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  userId: string;
  isFollowing: boolean;
  followerCount: number;
  onFollowChange?: (isFollowing: boolean, newCount: number) => void;
  showCount?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function FollowButton({
  userId,
  isFollowing: initialIsFollowing,
  followerCount: initialFollowerCount,
  onFollowChange,
  showCount = true,
  size = 'default',
  className,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleToggleFollow = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    const newFollowingState = !isFollowing;

    // Optimistic update
    setIsFollowing(newFollowingState);
    setFollowerCount(prev => newFollowingState ? prev + 1 : prev - 1);

    try {
      const response = await fetch(`/api/v1/social/follow/${userId}`, {
        method: newFollowingState ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update follow status');
      }

      const data = await response.json();

      // Update with server response if available
      if (data.followerCount !== undefined) {
        setFollowerCount(data.followerCount);
      }

      onFollowChange?.(newFollowingState, data.followerCount ?? followerCount);
    } catch (error) {
      // Revert on error
      setIsFollowing(!newFollowingState);
      setFollowerCount(prev => newFollowingState ? prev - 1 : prev + 1);
      console.error('Failed to update follow status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isFollowing, isLoading, followerCount, onFollowChange]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const getButtonContent = () => {
    if (isLoading) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading...</span>
        </>
      );
    }

    if (isFollowing) {
      return (
        <>
          <AnimatePresence mode="wait">
            <motion.span
              key={isHovered ? 'unfollow' : 'following'}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center gap-2"
            >
              {isHovered ? (
                <>
                  <UserMinus className="w-4 h-4" />
                  <span>Unfollow</span>
                </>
              ) : (
                <>
                  <UserMinus className="w-4 h-4" />
                  <span>Following</span>
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </>
      );
    }

    return (
      <>
        <UserPlus className="w-4 h-4" />
        <span>Follow</span>
      </>
    );
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant={isFollowing ? 'outline' : 'default'}
        size={size}
        onClick={handleToggleFollow}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isLoading}
        className={cn(
          "min-w-[100px] transition-all duration-200",
          isFollowing && isHovered && "border-destructive text-destructive hover:bg-destructive/10"
        )}
      >
        {getButtonContent()}
      </Button>

      {showCount && (
        <motion.span
          key={followerCount}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-sm text-muted-foreground"
        >
          {formatCount(followerCount)} {followerCount === 1 ? 'follower' : 'followers'}
        </motion.span>
      )}
    </div>
  );
}

export default FollowButton;
