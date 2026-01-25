/**
 * User Profile Page
 * Public profile page at /u/:username
 * Displays user's bio, avatar, social links, follower counts, and public recordings
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Twitter, Github, Globe, Calendar, Play, Pause,
  Clock, Music, Loader2, UserPlus, UserMinus, TrendingUp, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useToast } from '@/hooks/use-toast';
import { formatDuration } from '@/hooks/use-audio-recorder';
import { cn } from '@/lib/utils';

interface SocialLinks {
  twitter?: string | null;
  github?: string | null;
  website?: string | null;
}

interface PublicUserProfile {
  id: string;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  socialLinks: SocialLinks;
  followerCount: number;
  followingCount: number;
  recordingCount: number;
  isFollowing: boolean;
  createdAt: string;
}

interface PublicRecording {
  id: string;
  title: string;
  description?: string | null;
  duration: number;
  fileSize: number;
  fileUrl: string;
  format: string;
  playCount: number;
  createdAt: string;
  effectChain?: any[] | null;
}

export default function UserProfile() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute('/u/:username');
  const { user, isAuthenticated } = useSpaceChildAuth();
  const { toast } = useToast();

  const username = params?.username || '';

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [recordings, setRecordings] = useState<PublicRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!username) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/social/users/${username}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        }
        throw new Error('Failed to fetch profile');
      }

      const data: PublicUserProfile = await response.json();
      setProfile(data);
      setIsFollowing(data.isFollowing);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [username]);

  // Fetch recordings
  const fetchRecordings = useCallback(async () => {
    if (!profile) return;

    setIsLoadingRecordings(true);

    try {
      const response = await fetch(`/api/v1/social/users/${username}/recordings`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data: PublicRecording[] = await response.json();
        setRecordings(data);
      }
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
    } finally {
      setIsLoadingRecordings(false);
    }
  }, [profile, username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      fetchRecordings();
    }
  }, [profile, fetchRecordings]);

  // Handle follow/unfollow
  const handleFollowToggle = useCallback(async () => {
    if (!profile || !isAuthenticated) {
      toast({
        title: 'Sign in required',
        description: 'You need to sign in to follow users.',
        variant: 'destructive',
      });
      return;
    }

    setIsFollowLoading(true);

    try {
      const method = isFollowing ? 'DELETE' : 'POST';

      const response = await fetch(`/api/v1/social/follow/${profile.id}`, {
        method,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update follow status');
      }

      setIsFollowing(!isFollowing);
      setProfile(prev => prev ? {
        ...prev,
        followerCount: prev.followerCount + (isFollowing ? -1 : 1),
        isFollowing: !isFollowing,
      } : null);

      toast({
        title: isFollowing ? 'Unfollowed' : 'Following',
        description: isFollowing
          ? `You unfollowed @${profile.username}`
          : `You are now following @${profile.username}`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsFollowLoading(false);
    }
  }, [profile, isAuthenticated, isFollowing, toast]);

  // Handle play recording
  const handlePlay = useCallback((recording: PublicRecording) => {
    if (playingId === recording.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = recording.fileUrl;
        audioRef.current.play();
        setPlayingId(recording.id);

        // Track play count
        fetch(`/api/v1/recordings/${recording.id}/play`, { method: 'POST', credentials: 'include' });
      }
    }
  }, [playingId]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  };

  // Check if this is the user's own profile
  const isOwnProfile = user && profile && user.id === profile.id;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center h-16 px-6">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Skeleton className="h-6 w-32 ml-4" />
          </div>
        </header>
        <main className="container mx-auto p-6 max-w-3xl">
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="text-center">
              <Skeleton className="h-24 w-24 rounded-full mx-auto" />
              <Skeleton className="h-6 w-32 mx-auto mt-4" />
              <Skeleton className="h-4 w-64 mx-auto mt-2" />
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-8 mb-6">
                <Skeleton className="h-12 w-20" />
                <Skeleton className="h-12 w-20" />
              </div>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center h-16 px-6">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="ml-4 font-semibold">Profile</span>
          </div>
        </header>
        <main className="container mx-auto p-6 max-w-3xl">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error}</h2>
            <p className="text-muted-foreground mb-4">
              {error === 'User not found'
                ? 'This user does not exist or their profile is not public.'
                : 'Something went wrong while loading this profile.'}
            </p>
            <Button onClick={() => navigate('/')}>Go Home</Button>
          </div>
        </main>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onError={() => setPlayingId(null)}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-lg">@{profile.username}</span>
          </div>

          {isOwnProfile && (
            <Button variant="outline" size="sm" onClick={() => navigate('/profile')}>
              Edit Profile
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-card/50 backdrop-blur mb-6">
            <CardHeader className="text-center pb-4">
              {/* Avatar */}
              <div className="flex justify-center mb-4">
                <Avatar
                  src={profile.avatarUrl}
                  alt={profile.username}
                  fallback={profile.username[0]}
                  size="xl"
                />
              </div>

              {/* Username */}
              <CardTitle className="text-2xl">@{profile.username}</CardTitle>

              {/* Bio */}
              {profile.bio && (
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  {profile.bio}
                </p>
              )}

              {/* Join date */}
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-2">
                <Calendar className="w-4 h-4" />
                Joined {formatJoinDate(profile.createdAt)}
              </div>

              {/* Social Links */}
              {(profile.socialLinks?.twitter || profile.socialLinks?.github || profile.socialLinks?.website) && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  {profile.socialLinks.twitter && (
                    <a
                      href={`https://twitter.com/${profile.socialLinks.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                  {profile.socialLinks.github && (
                    <a
                      href={`https://github.com/${profile.socialLinks.github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Github className="w-5 h-5" />
                    </a>
                  )}
                  {profile.socialLinks.website && (
                    <a
                      href={profile.socialLinks.website.startsWith('http') ? profile.socialLinks.website : `https://${profile.socialLinks.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Globe className="w-5 h-5" />
                    </a>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent>
              {/* Stats */}
              <div className="flex items-center justify-center gap-8 py-4 border-y border-border">
                <div className="text-center">
                  <span className="text-2xl font-bold">{profile.followerCount}</span>
                  <p className="text-sm text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold">{profile.followingCount}</span>
                  <p className="text-sm text-muted-foreground">Following</p>
                </div>
                <div className="text-center">
                  <span className="text-2xl font-bold">{profile.recordingCount}</span>
                  <p className="text-sm text-muted-foreground">Recordings</p>
                </div>
              </div>

              {/* Follow Button */}
              {!isOwnProfile && (
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    variant={isFollowing ? 'outline' : 'default'}
                    className="min-w-[140px]"
                  >
                    {isFollowLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4 mr-2" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recordings */}
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Music className="w-5 h-5 text-cyan-500" />
                Public Recordings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRecordings ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : recordings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No public recordings yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    <AnimatePresence>
                      {recordings.map((recording) => (
                        <motion.div
                          key={recording.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className={cn(
                            "p-4 rounded-lg border transition-all cursor-pointer group",
                            playingId === recording.id
                              ? "bg-cyan-500/10 border-cyan-500/30"
                              : "bg-background/50 border-border hover:border-cyan-500/30 hover:bg-cyan-500/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {/* Play button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-12 w-12 shrink-0 rounded-full",
                                playingId === recording.id
                                  ? "bg-cyan-500 text-white hover:bg-cyan-600"
                                  : "bg-cyan-500/10 group-hover:bg-cyan-500/20"
                              )}
                              onClick={() => handlePlay(recording)}
                            >
                              {playingId === recording.id ? (
                                <Pause className="w-5 h-5" />
                              ) : (
                                <Play className="w-5 h-5 ml-0.5" />
                              )}
                            </Button>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{recording.title}</h4>
                              {recording.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {recording.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(recording.duration)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  {recording.playCount} plays
                                </span>
                                <span>{formatDate(recording.createdAt)}</span>
                              </div>

                              {/* Effect badges */}
                              {recording.effectChain && recording.effectChain.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {recording.effectChain
                                    .filter((e: any) => e.enabled)
                                    .slice(0, 3)
                                    .map((effect: any, i: number) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {effect.type}
                                      </Badge>
                                    ))}
                                  {recording.effectChain.filter((e: any) => e.enabled).length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{recording.effectChain.filter((e: any) => e.enabled).length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
