/**
 * User Avatar Component
 * Display user avatar with fallback to initials and link to profile
 */

import { forwardRef } from 'react';
import { Link } from 'wouter';
import { Avatar } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface User {
  id?: string;
  username: string;
  avatarUrl?: string | null;
  displayName?: string;
}

interface UserAvatarProps {
  user: User;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTooltip?: boolean;
  linkToProfile?: boolean;
  className?: string;
  onClick?: () => void;
}

export const UserAvatar = forwardRef<HTMLDivElement, UserAvatarProps>(
  ({
    user,
    size = 'md',
    showTooltip = true,
    linkToProfile = true,
    className,
    onClick,
  }, ref) => {
    const displayName = user.displayName || user.username;
    const profileUrl = user.id ? `/profile/${user.id}` : `/user/${user.username}`;

    const avatarElement = (
      <Avatar
        ref={ref}
        src={user.avatarUrl}
        alt={displayName}
        fallback={displayName}
        size={size}
        className={cn(
          linkToProfile && "cursor-pointer transition-transform hover:scale-105",
          onClick && "cursor-pointer",
          className
        )}
        onClick={onClick}
      />
    );

    // Wrap with tooltip if enabled
    const avatarWithTooltip = showTooltip ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {avatarElement}
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{displayName}</p>
            {user.displayName && user.displayName !== user.username && (
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : avatarElement;

    // Wrap with link if enabled
    if (linkToProfile && user.id) {
      return (
        <Link href={profileUrl}>
          {avatarWithTooltip}
        </Link>
      );
    }

    return avatarWithTooltip;
  }
);

UserAvatar.displayName = 'UserAvatar';

/**
 * Avatar Group Component
 * Display multiple avatars in a stacked layout
 */
interface AvatarGroupProps {
  users: User[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarGroup({
  users,
  max = 3,
  size = 'sm',
  className
}: AvatarGroupProps) {
  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  const overlapClasses = {
    sm: '-ml-2',
    md: '-ml-3',
    lg: '-ml-4',
  };

  return (
    <div className={cn("flex items-center", className)}>
      {visibleUsers.map((user, index) => (
        <div
          key={user.id || user.username}
          className={cn(
            "relative ring-2 ring-background rounded-full",
            index > 0 && overlapClasses[size]
          )}
          style={{ zIndex: visibleUsers.length - index }}
        >
          <UserAvatar
            user={user}
            size={size}
            showTooltip={true}
            linkToProfile={true}
          />
        </div>
      ))}

      {remainingCount > 0 && (
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full bg-muted ring-2 ring-background font-medium text-muted-foreground",
            sizeClasses[size],
            overlapClasses[size]
          )}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

export default UserAvatar;
