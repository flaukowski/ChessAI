/**
 * Settings Page
 * User account, privacy, API keys, and notification settings for AudioNoise Web
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Settings,
  User,
  Shield,
  Key,
  Bell,
  Mail,
  Lock,
  Trash2,
  Download,
  AlertTriangle,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useLocation } from 'wouter';
import { useSpaceChildAuth } from '@/hooks/use-space-child-auth';
import { useToast } from '@/hooks/use-toast';
import alienOctopusLogo from "@assets/IMG_20251007_202557_1766540112397_1768261396578.png";

// API helper for authenticated requests
const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('space-child-access-token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return response.json();
};

// Types for consent preferences
interface ConsentPreferences {
  analytics: boolean;
  marketing: boolean;
}

// Types for notification settings
interface NotificationSettings {
  email: boolean;
  inApp: boolean;
}

// Types for API keys
interface ApiKeys {
  openai: string;
  anthropic: string;
}

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useSpaceChildAuth();
  const { toast } = useToast();

  // Account Settings State
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Privacy & GDPR State
  const [consent, setConsent] = useState<ConsentPreferences>({ analytics: false, marketing: false });
  const [isLoadingConsent, setIsLoadingConsent] = useState(true);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ openai: '', anthropic: '' });
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
  const [isSavingAnthropic, setIsSavingAnthropic] = useState(false);

  // Notification Settings State
  const [notifications, setNotifications] = useState<NotificationSettings>({ email: true, inApp: true });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Dialog States
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountGDPRDialogOpen, setDeleteAccountGDPRDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Load consent preferences on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadConsentPreferences();
      loadNotificationSettings();
      loadApiKeyStatus();
    }
  }, [isAuthenticated]);

  const loadConsentPreferences = async () => {
    setIsLoadingConsent(true);
    try {
      const data = await authFetch('/api/v1/gdpr/consent');
      setConsent({
        analytics: data.analytics ?? false,
        marketing: data.marketing ?? false,
      });
    } catch (error) {
      console.error('Failed to load consent preferences:', error);
      // Use defaults on error
    } finally {
      setIsLoadingConsent(false);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const data = await authFetch('/api/v1/settings/notifications');
      setNotifications({
        email: data.email ?? true,
        inApp: data.inApp ?? true,
      });
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      // Use defaults on error
    }
  };

  const loadApiKeyStatus = async () => {
    try {
      const data = await authFetch('/api/v1/settings/api-keys/status');
      setApiKeys({
        openai: data.hasOpenAI ? '********' : '',
        anthropic: data.hasAnthropic ? '********' : '',
      });
    } catch (error) {
      console.error('Failed to load API key status:', error);
    }
  };

  // Account Settings Handlers
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !currentPassword) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    setIsUpdatingEmail(true);
    try {
      await authFetch('/api/v1/auth/change-email', {
        method: 'POST',
        body: JSON.stringify({ newEmail, currentPassword }),
      });
      toast({ title: 'Success', description: 'Email update request sent. Please check your new email for verification.' });
      setNewEmail('');
      setCurrentPassword('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update email', variant: 'destructive' });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await authFetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      toast({ title: 'Success', description: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update password', variant: 'destructive' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast({ title: 'Error', description: 'Please type DELETE to confirm', variant: 'destructive' });
      return;
    }

    setIsDeletingAccount(true);
    try {
      await authFetch('/api/v1/auth/delete-account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: deleteConfirmText }),
      });
      toast({ title: 'Account Deleted', description: 'Your account has been permanently deleted' });
      setDeleteAccountDialogOpen(false);
      navigate('/');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete account', variant: 'destructive' });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Privacy & GDPR Handlers
  const handleSaveConsent = async () => {
    setIsSavingConsent(true);
    try {
      await authFetch('/api/v1/gdpr/consent', {
        method: 'POST',
        body: JSON.stringify(consent),
      });
      toast({ title: 'Success', description: 'Consent preferences saved' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save consent preferences', variant: 'destructive' });
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleExportData = async () => {
    setIsExportingData(true);
    try {
      await authFetch('/api/v1/gdpr/export', {
        method: 'POST',
      });
      toast({
        title: 'Export Requested',
        description: 'You will receive an email with your data export within 24 hours',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to request data export', variant: 'destructive' });
    } finally {
      setIsExportingData(false);
    }
  };

  const handleGDPRDelete = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast({ title: 'Error', description: 'Please type DELETE to confirm', variant: 'destructive' });
      return;
    }

    setIsDeletingAccount(true);
    try {
      await authFetch('/api/v1/gdpr/delete', {
        method: 'POST',
        body: JSON.stringify({ confirmation: deleteConfirmText }),
      });
      toast({
        title: 'Deletion Scheduled',
        description: 'Your account will be deleted in 30 days. You can cancel this by contacting support.',
      });
      setDeleteAccountGDPRDialogOpen(false);
      setDeleteConfirmText('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to schedule account deletion', variant: 'destructive' });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // API Keys Handlers
  const handleSaveOpenAIKey = async () => {
    if (!apiKeys.openai || apiKeys.openai === '********') {
      toast({ title: 'Error', description: 'Please enter an API key', variant: 'destructive' });
      return;
    }

    setIsSavingOpenAI(true);
    try {
      await authFetch('/api/v1/settings/api-keys/openai', {
        method: 'POST',
        body: JSON.stringify({ apiKey: apiKeys.openai }),
      });
      toast({ title: 'Success', description: 'OpenAI API key saved and encrypted' });
      setApiKeys(prev => ({ ...prev, openai: '********' }));
      setShowOpenAIKey(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save API key', variant: 'destructive' });
    } finally {
      setIsSavingOpenAI(false);
    }
  };

  const handleSaveAnthropicKey = async () => {
    if (!apiKeys.anthropic || apiKeys.anthropic === '********') {
      toast({ title: 'Error', description: 'Please enter an API key', variant: 'destructive' });
      return;
    }

    setIsSavingAnthropic(true);
    try {
      await authFetch('/api/v1/settings/api-keys/anthropic', {
        method: 'POST',
        body: JSON.stringify({ apiKey: apiKeys.anthropic }),
      });
      toast({ title: 'Success', description: 'Anthropic API key saved and encrypted' });
      setApiKeys(prev => ({ ...prev, anthropic: '********' }));
      setShowAnthropicKey(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save API key', variant: 'destructive' });
    } finally {
      setIsSavingAnthropic(false);
    }
  };

  const handleDeleteOpenAIKey = async () => {
    setIsSavingOpenAI(true);
    try {
      await authFetch('/api/v1/settings/api-keys/openai', {
        method: 'DELETE',
      });
      toast({ title: 'Success', description: 'OpenAI API key removed' });
      setApiKeys(prev => ({ ...prev, openai: '' }));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to remove API key', variant: 'destructive' });
    } finally {
      setIsSavingOpenAI(false);
    }
  };

  const handleDeleteAnthropicKey = async () => {
    setIsSavingAnthropic(true);
    try {
      await authFetch('/api/v1/settings/api-keys/anthropic', {
        method: 'DELETE',
      });
      toast({ title: 'Success', description: 'Anthropic API key removed' });
      setApiKeys(prev => ({ ...prev, anthropic: '' }));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to remove API key', variant: 'destructive' });
    } finally {
      setIsSavingAnthropic(false);
    }
  };

  // Notification Settings Handlers
  const handleSaveNotifications = async () => {
    setIsSavingNotifications(true);
    try {
      await authFetch('/api/v1/settings/notifications', {
        method: 'POST',
        body: JSON.stringify(notifications),
      });
      toast({ title: 'Success', description: 'Notification settings saved' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save notification settings', variant: 'destructive' });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-12 pb-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
            <p className="text-muted-foreground mb-8">
              Please sign in to access your settings.
            </p>
            <Button onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-16 px-6 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={alienOctopusLogo} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl">AudioNoise Web</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-full bg-cyan-500/20">
              <Settings className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your account and preferences</p>
            </div>
          </div>

          <Tabs defaultValue="account" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="account" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Account</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Privacy</span>
              </TabsTrigger>
              <TabsTrigger value="api-keys" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline">API Keys</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
            </TabsList>

            {/* Account Settings Tab */}
            <TabsContent value="account" className="space-y-6">
              {/* Change Email */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Change Email
                  </CardTitle>
                  <CardDescription>
                    Update your email address. You will need to verify the new email.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateEmail} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Current Email</Label>
                      <Input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newEmail">New Email</Label>
                      <Input
                        id="newEmail"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter new email address"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emailCurrentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="emailCurrentPassword"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" disabled={isUpdatingEmail}>
                      {isUpdatingEmail ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Update Email
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Change Password */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your password. Must be at least 8 characters.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="passwordCurrentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="passwordCurrentPassword"
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          minLength={8}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          minLength={8}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" disabled={isUpdatingPassword}>
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Update Password
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Delete Account */}
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="w-5 h-5" />
                    Delete Account
                  </CardTitle>
                  <CardDescription>
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteAccountDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy & GDPR Tab */}
            <TabsContent value="privacy" className="space-y-6">
              {/* Consent Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Consent Preferences
                  </CardTitle>
                  <CardDescription>
                    Manage your data collection and privacy preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingConsent ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="analytics-consent">Analytics</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow us to collect anonymous usage data to improve the app
                          </p>
                        </div>
                        <Switch
                          id="analytics-consent"
                          checked={consent.analytics}
                          onCheckedChange={(checked) => setConsent(prev => ({ ...prev, analytics: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label htmlFor="marketing-consent">Marketing</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive updates about new features and promotions
                          </p>
                        </div>
                        <Switch
                          id="marketing-consent"
                          checked={consent.marketing}
                          onCheckedChange={(checked) => setConsent(prev => ({ ...prev, marketing: checked }))}
                        />
                      </div>
                      <Button onClick={handleSaveConsent} disabled={isSavingConsent}>
                        {isSavingConsent ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Preferences
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Data Export */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Export My Data
                  </CardTitle>
                  <CardDescription>
                    Request a copy of all your personal data in a portable format (GDPR Article 20)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleExportData} disabled={isExportingData}>
                    {isExportingData ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Requesting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export My Data
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* GDPR Delete */}
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2 className="w-5 h-5" />
                    Request Account Deletion
                  </CardTitle>
                  <CardDescription>
                    Request deletion of your account and all data (GDPR Article 17 - Right to be Forgotten).
                    Your account will be scheduled for deletion in 30 days, giving you time to cancel if needed.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                      After 30 days, all your data will be permanently deleted and cannot be recovered.
                    </AlertDescription>
                  </Alert>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteAccountGDPRDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Request Deletion
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* API Keys Tab */}
            <TabsContent value="api-keys" className="space-y-6">
              <Alert>
                <Key className="h-4 w-4" />
                <AlertTitle>Secure Storage</AlertTitle>
                <AlertDescription>
                  Your API keys are encrypted at rest and are only used for AI-powered suggestions.
                  We never share your keys with third parties.
                </AlertDescription>
              </Alert>

              {/* OpenAI API Key */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    OpenAI API Key
                  </CardTitle>
                  <CardDescription>
                    Add your OpenAI API key for GPT-powered effect suggestions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="openai-key"
                        type={showOpenAIKey ? 'text' : 'password'}
                        value={apiKeys.openai}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                        placeholder="sk-..."
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      >
                        {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveOpenAIKey} disabled={isSavingOpenAI}>
                      {isSavingOpenAI ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Key
                        </>
                      )}
                    </Button>
                    {apiKeys.openai === '********' && (
                      <Button
                        variant="outline"
                        onClick={handleDeleteOpenAIKey}
                        disabled={isSavingOpenAI}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Anthropic API Key */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    Anthropic API Key
                  </CardTitle>
                  <CardDescription>
                    Add your Anthropic API key for Claude-powered effect suggestions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="anthropic-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="anthropic-key"
                        type={showAnthropicKey ? 'text' : 'password'}
                        value={apiKeys.anthropic}
                        onChange={(e) => setApiKeys(prev => ({ ...prev, anthropic: e.target.value }))}
                        placeholder="sk-ant-..."
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                      >
                        {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveAnthropicKey} disabled={isSavingAnthropic}>
                      {isSavingAnthropic ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Key
                        </>
                      )}
                    </Button>
                    {apiKeys.anthropic === '********' && (
                      <Button
                        variant="outline"
                        onClick={handleDeleteAnthropicKey}
                        disabled={isSavingAnthropic}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Settings
                  </CardTitle>
                  <CardDescription>
                    Control how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive important updates and news via email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={notifications.email}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="inapp-notifications">In-App Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Show notifications within the application
                      </p>
                    </div>
                    <Switch
                      id="inapp-notifications"
                      checked={notifications.inApp}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, inApp: checked }))}
                    />
                  </div>
                  <Button onClick={handleSaveNotifications} disabled={isSavingNotifications}>
                    {isSavingNotifications ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data, recordings, and settings will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAccountDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GDPR Delete Account Dialog */}
      <Dialog open={deleteAccountGDPRDialogOpen} onOpenChange={setDeleteAccountGDPRDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Request Account Deletion
            </DialogTitle>
            <DialogDescription>
              Your account will be scheduled for deletion in 30 days. During this period, you can contact support to cancel the deletion request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>30-Day Notice Period</AlertTitle>
              <AlertDescription>
                After 30 days, all your data will be permanently deleted in compliance with GDPR Article 17.
              </AlertDescription>
            </Alert>
            <Label htmlFor="gdpr-delete-confirm">Type DELETE to confirm</Label>
            <Input
              id="gdpr-delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteAccountGDPRDialogOpen(false);
              setDeleteConfirmText('');
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleGDPRDelete}
              disabled={isDeletingAccount || deleteConfirmText !== 'DELETE'}
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Request Deletion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto text-center text-sm text-muted-foreground">
          2025 AudioNoise Web. GPL v2 License.
        </div>
      </footer>
    </div>
  );
}
