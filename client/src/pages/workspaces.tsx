/**
 * Workspaces List Page
 * Lists all workspaces the user belongs to with the ability to create new workspaces
 */

import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  ChevronLeft,
  Loader2,
  FolderOpen,
  Crown,
  Edit3,
  Eye,
  Search,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

import alienOctopusLogo from '@assets/IMG_20251007_202557_1766540112397_1768261396578.png';

interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  memberCount: number;
  userRole: 'admin' | 'editor' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

interface UserSubscription {
  tier: 'free' | 'pro' | 'studio';
}

const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    icon: Crown,
    variant: 'default' as const,
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  editor: {
    label: 'Editor',
    icon: Edit3,
    variant: 'secondary' as const,
    className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    variant: 'outline' as const,
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
};

export default function WorkspacesPage() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useSpaceChildAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');

  // Fetch user's workspaces
  const {
    data: workspaces = [],
    isLoading: workspacesLoading,
    error: workspacesError,
  } = useQuery<Workspace[]>({
    queryKey: ['/api/v1/workspaces'],
    enabled: isAuthenticated,
  });

  // Fetch user subscription to check if they can create workspaces
  const { data: subscription } = useQuery<UserSubscription>({
    queryKey: ['/api/v1/user/subscription'],
    enabled: isAuthenticated,
  });

  const isStudioTier = subscription?.tier === 'studio';

  // Create workspace mutation
  const createWorkspaceMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await apiRequest('POST', '/api/v1/workspaces', data);
      return res.json();
    },
    onSuccess: (newWorkspace: Workspace) => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/workspaces'] });
      setCreateDialogOpen(false);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
      toast({
        title: 'Workspace created',
        description: `"${newWorkspace.name}" has been created successfully.`,
      });
      navigate(`/workspaces/${newWorkspace.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create workspace',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateWorkspace = useCallback(() => {
    if (!newWorkspaceName.trim()) return;
    createWorkspaceMutation.mutate({
      name: newWorkspaceName.trim(),
      description: newWorkspaceDescription.trim() || undefined,
    });
  }, [newWorkspaceName, newWorkspaceDescription, createWorkspaceMutation]);

  const handleWorkspaceClick = useCallback(
    (workspaceId: string) => {
      navigate(`/workspaces/${workspaceId}`);
    },
    [navigate]
  );

  const handleHomeClick = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Filter workspaces by search query
  const filteredWorkspaces = workspaces.filter(
    (workspace) =>
      workspace.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workspace.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show loading state while auth is being verified
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <Loader2 className="w-12 h-12 text-cyan-500" />
          </motion.div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleHomeClick}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={alienOctopusLogo} alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold text-xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                Workspaces
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-muted-foreground hidden md:block">
                {user.firstName || user.email}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-6xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="w-8 h-8 text-cyan-500" />
              My Workspaces
            </h1>
            <p className="text-muted-foreground mt-1">
              Collaborate with your team on audio projects
            </p>
          </div>

          {isStudioTier ? (
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Workspace
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                Studio Tier Required
              </Badge>
              <Button variant="outline" onClick={() => navigate('/pricing')}>
                Upgrade
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 max-w-md"
          />
        </div>

        {/* Workspaces Grid */}
        {workspacesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-card/50">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : workspacesError ? (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="py-12 text-center">
              <p className="text-destructive">Failed to load workspaces</p>
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/v1/workspaces'] })}
                className="mt-4"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : filteredWorkspaces.length === 0 ? (
          <Card className="bg-card/50 backdrop-blur">
            <CardContent className="py-16 text-center">
              <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
              {searchQuery ? (
                <>
                  <p className="text-lg font-medium">No workspaces found</p>
                  <p className="text-muted-foreground mt-1">
                    Try a different search term
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No workspaces yet</p>
                  <p className="text-muted-foreground mt-1">
                    {isStudioTier
                      ? 'Create your first workspace to start collaborating'
                      : 'Upgrade to Studio tier to create workspaces'}
                  </p>
                  {isStudioTier && (
                    <Button onClick={() => setCreateDialogOpen(true)} className="mt-4 gap-2">
                      <Plus className="w-4 h-4" />
                      Create Workspace
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredWorkspaces.map((workspace, index) => {
                const roleConfig = ROLE_CONFIG[workspace.userRole];
                const RoleIcon = roleConfig.icon;

                return (
                  <motion.div
                    key={workspace.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={cn(
                        'bg-card/50 backdrop-blur cursor-pointer transition-all hover:bg-card/70 hover:border-cyan-500/30',
                        'border-border'
                      )}
                      onClick={() => handleWorkspaceClick(workspace.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg truncate flex-1">
                            {workspace.name}
                          </CardTitle>
                          <Badge className={cn('shrink-0 ml-2', roleConfig.className)}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {roleConfig.label}
                          </Badge>
                        </div>
                        {workspace.description && (
                          <CardDescription className="line-clamp-2">
                            {workspace.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>
                              {workspace.memberCount}{' '}
                              {workspace.memberCount === 1 ? 'member' : 'members'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Create Workspace Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Create Workspace
            </DialogTitle>
            <DialogDescription>
              Create a new workspace to collaborate with your team on audio projects.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                placeholder="My Audio Team"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newWorkspaceName.trim()) {
                    handleCreateWorkspace();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-description">Description (optional)</Label>
              <Input
                id="workspace-description"
                placeholder="A workspace for our audio production team"
                value={newWorkspaceDescription}
                onChange={(e) => setNewWorkspaceDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim() || createWorkspaceMutation.isPending}
            >
              {createWorkspaceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workspace
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
