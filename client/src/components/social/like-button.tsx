/**
 * Like Button Component
 * Toggle like on recordings with heart animation
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
  recordingId: string;
  isLiked: boolean;
  likeCount: number;
  onLikeChange?: (isLiked: boolean, newCount: number) => void;
  showCount?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'button' | 'icon';
  className?: string;
}

export function LikeButton({
  recordingId,
  isLiked: initialIsLiked,
  likeCount: initialLikeCount,
  onLikeChange,
  showCount = true,
  size = 'default',
  variant = 'icon',
  className,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);
  const [showParticles, setShowParticles] = useState(false);

  const handleToggleLike = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    const newLikedState = !isLiked;

    // Optimistic update
    setIsLiked(newLikedState);
    setLikeCount(prev => newLikedState ? prev + 1 : prev - 1);

    // Trigger particle animation on like
    if (newLikedState) {
      setShowParticles(true);
      setTimeout(() => setShowParticles(false), 700);
    }

    try {
      const response = await fetch(`/api/v1/social/recordings/${recordingId}/like`, {
        method: newLikedState ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update like status');
      }

      const data = await response.json();

      // Update with server response if available
      if (data.likeCount !== undefined) {
        setLikeCount(data.likeCount);
      }

      onLikeChange?.(newLikedState, data.likeCount ?? likeCount);
    } catch (error) {
      // Revert on error
      setIsLiked(!newLikedState);
      setLikeCount(prev => newLikedState ? prev - 1 : prev + 1);
      console.error('Failed to update like status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [recordingId, isLiked, isLoading, likeCount, onLikeChange]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    default: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  // Generate particle positions for the burst animation
  const particles = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    angle: (i * 60) * (Math.PI / 180),
  }));

  if (variant === 'icon') {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleLike}
            disabled={isLoading}
            className={cn(
              "relative overflow-visible transition-all duration-200",
              sizeClasses[size],
              isLiked && "text-red-500 hover:text-red-600"
            )}
          >
            {isLoading ? (
              <Loader2 className={cn(iconSizeClasses[size], "animate-spin")} />
            ) : (
              <motion.div
                whileTap={{ scale: 0.8 }}
                animate={isLiked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Heart
                  className={cn(
                    iconSizeClasses[size],
                    "transition-all duration-200",
                    isLiked && "fill-current"
                  )}
                />
              </motion.div>
            )}
          </Button>

          {/* Particle burst animation */}
          <AnimatePresence>
            {showParticles && (
              <>
                {particles.map(({ id, angle }) => (
                  <motion.div
                    key={id}
                    initial={{
                      scale: 0,
                      x: 0,
                      y: 0,
                      opacity: 1
                    }}
                    animate={{
                      scale: [0, 1, 0],
                      x: Math.cos(angle) * 20,
                      y: Math.sin(angle) * 20,
                      opacity: [1, 1, 0],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  >
                    <Heart className="w-2 h-2 fill-red-500 text-red-500" />
                  </motion.div>
                ))}
              </>
            )}
          </AnimatePresence>
        </div>

        {showCount && (
          <motion.span
            key={likeCount}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "text-sm tabular-nums",
              isLiked ? "text-red-500" : "text-muted-foreground"
            )}
          >
            {formatCount(likeCount)}
          </motion.span>
        )}
      </div>
    );
  }

  // Button variant
  return (
    <Button
      variant={isLiked ? 'default' : 'outline'}
      size={size}
      onClick={handleToggleLike}
      disabled={isLoading}
      className={cn(
        "transition-all duration-200",
        isLiked && "bg-red-500 hover:bg-red-600 text-white border-red-500",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
      ) : (
        <motion.div
          whileTap={{ scale: 0.8 }}
          animate={isLiked ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
          className="mr-2"
        >
          <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
        </motion.div>
      )}
      <span>{isLiked ? 'Liked' : 'Like'}</span>
      {showCount && (
        <span className="ml-1.5 text-sm opacity-80">({formatCount(likeCount)})</span>
      )}
    </Button>
  );
}

export default LikeButton;
