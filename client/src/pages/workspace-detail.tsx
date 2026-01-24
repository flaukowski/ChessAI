/**
 * Workspace Detail Page
 * Shows workspace settings, members, recordings, and management options
 */

import { useState, useCallback } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  ChevronLeft,
  Loader2,
  Settings,
  Crown,
  Edit3,
  Eye,
  Music,
  UserPlus,
  MoreVertical,
  Trash2,
  Mail,
  Clock,
  Play,
  Calendar,
  Building2,
  Shield,
  Check,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

import alienOctopusLogo from '@assets/IMG_20251007_202557_1766540112397_1768261396578.png';

type WorkspaceRole = 'admin' | 'editor' | 'viewer';

interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  memberCount: number;
  userRole: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceMember {
  id: string;
  uid: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

interface WorkspaceRecording {
  id: string;
  title: string;
  description?: string | null;
  duration: number;
  fileSize: number;
  fileUrl: string;
  format: string;
  createdAt: string;
  createdBy: {
    email: string;
    firstName?: string | null;
  };
}

const ROLE_CONFIG = {
  admin: {
    label: 'Admin',
    icon: Crown,
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'Full access to workspace settings and member management',
  },
  editor: {
    label: 'Editor',
    icon: Edit3,
    className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    description: 'Can upload, edit, and delete recordings',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    description: 'Can view and play recordings only',
  },
};

export default function WorkspaceDetailPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;
  const { user, isAuthenticated, isLoading: authLoading } = useSpaceChildAuth();
  const { toast } = useToast();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('viewer');
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);
  const [newRole, setNewRole] = useState<WorkspaceRole>('viewer');
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Fetch workspace details
  const {
    data: workspace,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useQuery<Workspace>({
    queryKey: ['/api/v1/workspaces', workspaceId],
    enabled: isAuthenticated && !!workspaceId,
  });

  // Fetch workspace members
  const {
    data: members = [],
    isLoading: membersLoading,
  } = useQuery<WorkspaceMember[]>({
    queryKey: [`/api/v1/workspaces/${workspaceId}/members`],
    enabled: isAuthenticated && !!workspaceId,
  });

  // Fetch workspace recordings
  const {
    data: recordings = [],
    isLoading: recordingsLoading,
  } = useQuery<WorkspaceRecording[]>({
    queryKey: [`/api/v1/workspaces/${workspaceId}/recordings`],
    enabled: isAuthenticated && !!workspaceId,
  });

  const isAdmin = workspace?.userRole === 'admin';

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async (data: { email: string; role: WorkspaceRole }) => {
      const res = await apiRequest('POST', `/api/v1/workspaces/${workspaceId}/invite`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/workspaces/${workspaceId}/members`] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/workspaces', workspaceId] });
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      toast({
        title: 'Invitation sent',
        description: `An invitation has been sent to ${inviteEmail}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to invite member',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (data: { uid: string; role: WorkspaceRole }) => {
      const res = await apiRequest(
        'PUT',
        `/api/v1/workspaces/${workspaceId}/members/${data.uid}`,
        { role: data.role }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/workspaces/${workspaceId}/members`] });
      setEditRoleDialogOpen(false);
      setEditingMember(null);
      toast({
        title: 'Role updated',
        description: 'Member role has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (uid: string) => {
      await apiRequest('DELETE', `/api/v1/workspaces/${workspaceId}/members/${uid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v1/workspaces/${workspaceId}/members`] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/workspaces', workspaceId] });
      toast({
        title: 'Member removed',
        description: 'Member has been removed from the workspace.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to remove member',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update workspace settings mutation
  const updateWorkspaceMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await apiRequest('PUT', `/api/v1/workspaces/${workspaceId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/v1/workspaces', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/workspaces'] });
      setSettingsDialogOpen(false);
      toast({
        title: 'Settings updated',
        description: 'Workspace settings have been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleInvite = useCallback(() => {
    if (!inviteEmail.trim()) return;
    inviteMemberMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  }, [inviteEmail, inviteRole, inviteMemberMutation]);

  const handleUpdateRole = useCallback(() => {
    if (!editingMember) return;
    updateRoleMutation.mutate({ uid: editingMember.uid, role: newRole });
  }, [editingMember, newRole, updateRoleMutation]);

  const handleRemoveMember = useCallback(
    (member: WorkspaceMember) => {
      if (!confirm(`Are you sure you want to remove ${member.email} from this workspace?`)) {
        return;
      }
      removeMemberMutation.mutate(member.uid);
    },
    [removeMemberMutation]
  );

  const handleOpenEditRole = useCallback((member: WorkspaceMember) => {
    setEditingMember(member);
    setNewRole(member.role);
    setEditRoleDialogOpen(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    if (workspace) {
      setEditName(workspace.name);
      setEditDescription(workspace.description || '');
      setSettingsDialogOpen(true);
    }
  }, [workspace]);

  const handleSaveSettings = useCallback(() => {
    if (!editName.trim()) return;
    updateWorkspaceMutation.mutate({
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    });
  }, [editName, editDescription, updateWorkspaceMutation]);

  const handleBackClick = useCallback(() => {
    navigate('/workspaces');
  }, [navigate]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

  // Show loading state for workspace
  if (workspaceLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBackClick}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Skeleton className="h-6 w-48" />
            </div>
          </div>
        </header>
        <main className="container mx-auto p-6 max-w-6xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="grid gap-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </main>
      </div>
    );
  }

  // Show error state
  if (workspaceError || !workspace) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBackClick}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="font-bold text-xl">Workspace</span>
            </div>
          </div>
        </header>
        <main className="container mx-auto p-6 max-w-6xl">
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="py-12 text-center">
              <p className="text-destructive">Failed to load workspace</p>
              <p className="text-sm text-muted-foreground mt-2">
                The workspace may not exist or you may not have access to it.
              </p>
              <Button variant="outline" onClick={handleBackClick} className="mt-4">
                Back to Workspaces
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const roleConfig = ROLE_CONFIG[workspace.userRole];
  const RoleIcon = roleConfig.icon;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackClick}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src={alienOctopusLogo} alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-bold text-xl text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                {workspace.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge className={cn('shrink-0', roleConfig.className)}>
              <RoleIcon className="w-3 h-3 mr-1" />
              {roleConfig.label}
            </Badge>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={handleOpenSettings}>
                <Settings className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 max-w-6xl">
        {/* Workspace Info */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="w-8 h-8 text-cyan-500" />
            {workspace.name}
          </h1>
          {workspace.description && (
            <p className="text-muted-foreground mt-2">{workspace.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>
                {workspace.memberCount} {workspace.memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Created {formatDate(workspace.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="members" className="space-y-6">
          <TabsList>
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="recordings" className="gap-2">
              <Music className="w-4 h-4" />
              Recordings
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Team Members</h2>
              {isAdmin && (
                <Button onClick={() => setInviteDialogOpen(true)} className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  Invite Member
                </Button>
              )}
            </div>

            <Card className="bg-card/50 backdrop-blur">
              {membersLoading ? (
                <CardContent className="py-8">
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32 mt-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              ) : members.length === 0 ? (
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto opacity-50 mb-4" />
                  <p>No members found</p>
                </CardContent>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const memberRoleConfig = ROLE_CONFIG[member.role];
                      const MemberRoleIcon = memberRoleConfig.icon;
                      const isCurrentUser = member.uid === user?.id;
                      const isOwner = member.uid === workspace.ownerId;

                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {(member.firstName?.[0] || member.email[0]).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">
                                  {member.firstName
                                    ? `${member.firstName}${member.lastName ? ` ${member.lastName}` : ''}`
                                    : member.email}
                                  {isCurrentUser && (
                                    <span className="text-muted-foreground ml-2">(you)</span>
                                  )}
                                  {isOwner && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      Owner
                                    </Badge>
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(memberRoleConfig.className)}>
                              <MemberRoleIcon className="w-3 h-3 mr-1" />
                              {memberRoleConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(member.joinedAt)}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {!isOwner && !isCurrentUser && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenEditRole(member)}>
                                      <Shield className="w-4 h-4 mr-2" />
                                      Change Role
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleRemoveMember(member)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Remove Member
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>

          {/* Recordings Tab */}
          <TabsContent value="recordings" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Workspace Recordings</h2>
            </div>

            <Card className="bg-card/50 backdrop-blur">
              {recordingsLoading ? (
                <CardContent className="py-8">
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-32 mt-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              ) : recordings.length === 0 ? (
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Music className="w-12 h-12 mx-auto opacity-50 mb-4" />
                  <p>No recordings yet</p>
                  <p className="text-sm mt-2">
                    Recordings shared with this workspace will appear here
                  </p>
                </CardContent>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="p-4 space-y-3">
                    <AnimatePresence>
                      {recordings.map((recording, index) => (
                        <motion.div
                          key={recording.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-4 rounded-lg border bg-background/50 hover:bg-background/70 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                              <Play className="w-5 h-5" />
                            </Button>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{recording.title}</h4>
                              {recording.description && (
                                <p className="text-sm text-muted-foreground truncate mt-1">
                                  {recording.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDuration(recording.duration)}
                                </span>
                                <span>{formatFileSize(recording.fileSize)}</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(recording.createdAt)}
                                </span>
                                <span>
                                  by {recording.createdBy.firstName || recording.createdBy.email}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Invite Member
            </DialogTitle>
            <DialogDescription>
              Invite a new member to join this workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as WorkspaceRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <config.icon className="w-4 h-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_CONFIG[inviteRole].description}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviteMemberMutation.isPending}
            >
              {inviteMemberMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editRoleDialogOpen} onOpenChange={setEditRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Change Member Role
            </DialogTitle>
            <DialogDescription>
              Update the role for {editingMember?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={(value) => setNewRole(value as WorkspaceRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_CONFIG).map(([role, config]) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <config.icon className="w-4 h-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{ROLE_CONFIG[newRole].description}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Update Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workspace Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Workspace Settings
            </DialogTitle>
            <DialogDescription>
              Update workspace name and description.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Workspace Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={!editName.trim() || updateWorkspaceMutation.isPending}
            >
              {updateWorkspaceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
