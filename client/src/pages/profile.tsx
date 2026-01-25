/**
 * Profile Page
 * User's own profile editing page with bio, avatar, and social links
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  User, Save, Loader2, ArrowLeft, ExternalLink, Users, Twitter, Github, Globe,
  Link as LinkIcon, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SocialLinks {
  twitter?: string | null;
  github?: string | null;
  website?: string | null;
}

interface UserProfile {
  id: string;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  socialLinks: SocialLinks;
  followerCount: number;
  followingCount: number;
  createdAt: string;
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useSpaceChildAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [twitter, setTwitter] = useState('');
  const [github, setGithub] = useState('');
  const [website, setWebsite] = useState('');

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/social/profile', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Profile doesn't exist yet, that's okay
          setProfile(null);
          return;
        }
        throw new Error('Failed to fetch profile');
      }

      const data: UserProfile = await response.json();
      setProfile(data);

      // Initialize form state
      setBio(data.bio || '');
      setAvatarUrl(data.avatarUrl || '');
      setTwitter(data.socialLinks?.twitter || '');
      setGithub(data.socialLinks?.github || '');
      setWebsite(data.socialLinks?.website || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, fetchProfile]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Track changes
  useEffect(() => {
    if (!profile) {
      setHasChanges(bio !== '' || avatarUrl !== '' || twitter !== '' || github !== '' || website !== '');
      return;
    }

    const changed =
      bio !== (profile.bio || '') ||
      avatarUrl !== (profile.avatarUrl || '') ||
      twitter !== (profile.socialLinks?.twitter || '') ||
      github !== (profile.socialLinks?.github || '') ||
      website !== (profile.socialLinks?.website || '');

    setHasChanges(changed);
  }, [bio, avatarUrl, twitter, github, website, profile]);

  // Save profile
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/v1/social/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          bio: bio.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
          socialLinks: {
            twitter: twitter.trim() || null,
            github: github.trim() || null,
            website: website.trim() || null,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save profile');
      }

      const data: UserProfile = await response.json();
      setProfile(data);
      setHasChanges(false);

      toast({
        title: 'Profile saved',
        description: 'Your profile has been updated successfully.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [bio, avatarUrl, twitter, github, website, toast]);

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center h-16 px-6">
            <Skeleton className="h-8 w-32" />
          </div>
        </header>
        <main className="container mx-auto p-6 max-w-2xl">
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader>
              <Skeleton className="h-24 w-24 rounded-full mx-auto" />
              <Skeleton className="h-6 w-48 mx-auto mt-4" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchProfile()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/studio')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-lg">Edit Profile</span>
          </div>

          <div className="flex items-center gap-2">
            {profile?.username && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/u/${profile.username}`)}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Public Profile
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Avatar
                  src={avatarUrl || profile?.avatarUrl}
                  alt={user?.firstName || user?.email}
                  fallback={user?.firstName?.[0] || user?.email?.[0]}
                  size="xl"
                />
              </div>
              <CardTitle className="flex items-center justify-center gap-2">
                <User className="w-5 h-5" />
                {profile?.username || user?.email?.split('@')[0] || 'Your Profile'}
              </CardTitle>
              <CardDescription>
                Customize your public profile
              </CardDescription>

              {/* Follower/Following Stats */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <Users className="w-4 h-4" />
                    Followers
                  </div>
                  <span className="text-2xl font-bold">{profile?.followerCount || 0}</span>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-muted-foreground text-sm">
                    <Users className="w-4 h-4" />
                    Following
                  </div>
                  <span className="text-2xl font-bold">{profile?.followingCount || 0}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Avatar URL */}
              <div className="space-y-2">
                <Label htmlFor="avatarUrl" className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Avatar URL
                </Label>
                <Input
                  id="avatarUrl"
                  type="url"
                  placeholder="https://example.com/your-avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a URL to an image to use as your avatar
                </p>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell others about yourself and your audio work..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="bg-background min-h-[100px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.length}/500 characters
                </p>
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Social Links
                </h3>

                <div className="space-y-4">
                  {/* Twitter */}
                  <div className="space-y-2">
                    <Label htmlFor="twitter" className="flex items-center gap-2">
                      <Twitter className="w-4 h-4" />
                      Twitter / X
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        @
                      </span>
                      <Input
                        id="twitter"
                        placeholder="username"
                        value={twitter}
                        onChange={(e) => setTwitter(e.target.value.replace('@', ''))}
                        className="bg-background pl-8"
                      />
                    </div>
                  </div>

                  {/* GitHub */}
                  <div className="space-y-2">
                    <Label htmlFor="github" className="flex items-center gap-2">
                      <Github className="w-4 h-4" />
                      GitHub
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        github.com/
                      </span>
                      <Input
                        id="github"
                        placeholder="username"
                        value={github}
                        onChange={(e) => setGithub(e.target.value)}
                        className="bg-background pl-[90px]"
                      />
                    </div>
                  </div>

                  {/* Website */}
                  <div className="space-y-2">
                    <Label htmlFor="website" className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      placeholder="https://your-website.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Save indicator */}
              {hasChanges && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-amber-500"
                >
                  <AlertCircle className="w-4 h-4" />
                  You have unsaved changes
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
