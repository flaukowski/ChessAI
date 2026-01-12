/**
 * SonicVision Auth Modal
 * Beautiful login/register modal powered by Space Child Auth
 */

import { useState } from "react";
import { useSpaceChildAuth } from "@/hooks/use-space-child-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Music, Loader2, Eye, EyeOff, Mail, CheckCircle } from "lucide-react";
import { forgotPassword, resendVerification } from "@/lib/space-child-auth";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ModalView = "auth" | "verification-pending" | "forgot-password" | "forgot-sent";

export function SpaceChildAuthModal({ open, onOpenChange }: AuthModalProps) {
  const { login, register, error: authError } = useSpaceChildAuth();
  const [view, setView] = useState<ModalView>("auth");
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login({ email, password });
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      if (err.requiresVerification) {
        setPendingEmail(email);
        setView("verification-pending");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      const result = await register({ email, password, firstName, lastName });
      if (result?.requiresVerification) {
        setPendingEmail(email);
        setView("verification-pending");
      } else {
        onOpenChange(false);
        resetForm();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await forgotPassword(email);
      setView("forgot-sent");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await resendVerification(pendingEmail);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
    setError(null);
    setView("auth");
  };

  const displayError = error || authError;

  if (view === "verification-pending") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
        <DialogContent className="sm:max-w-[400px] bg-slate-900 border-cyan-500/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Mail className="w-5 h-5 text-cyan-400" />
              Verify Your Email
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Mail className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-white mb-2">Check your inbox</p>
            <p className="text-gray-400 text-sm mb-4">
              We sent a verification link to <span className="text-cyan-400">{pendingEmail}</span>
            </p>
            {displayError && <p className="text-red-400 text-sm mb-4">{displayError}</p>}
            <Button variant="outline" onClick={handleResend} disabled={isLoading} className="border-white/10">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Resend verification
            </Button>
          </div>
          <Button variant="ghost" onClick={resetForm} className="w-full text-gray-400">
            Back to login
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (view === "forgot-password" || view === "forgot-sent") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
        <DialogContent className="sm:max-w-[400px] bg-slate-900 border-cyan-500/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              {view === "forgot-sent" ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Music className="w-5 h-5 text-cyan-400" />}
              {view === "forgot-sent" ? "Check Your Email" : "Reset Password"}
            </DialogTitle>
          </DialogHeader>
          {view === "forgot-sent" ? (
            <div className="py-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-400" />
              </div>
              <p className="text-white mb-2">Reset link sent!</p>
              <p className="text-gray-400 text-sm">Check your email for the reset link.</p>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-800 border-white/10 text-white" required />
              </div>
              {displayError && <p className="text-red-400 text-sm">{displayError}</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-purple-600" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Send Reset Link
              </Button>
            </form>
          )}
          <Button variant="ghost" onClick={resetForm} className="w-full text-gray-400">Back to login</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[400px] bg-slate-900 border-cyan-500/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Music className="w-5 h-5 text-cyan-400" />
            SonicVision Auth
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Sign in to save your creations and settings
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v: string) => { setTab(v as "login" | "register"); setError(null); }}>
          <TabsList className="grid w-full grid-cols-2 bg-slate-800">
            <TabsTrigger value="login" className="data-[state=active]:bg-cyan-500/20">Sign In</TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-cyan-500/20">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4 mt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-800 border-white/10 text-white" required />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Password</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-800 border-white/10 text-white pr-10" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setView("forgot-password")} className="text-sm text-cyan-400 hover:text-cyan-300">Forgot password?</button>
              {displayError && <p className="text-red-400 text-sm">{displayError}</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-purple-600" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Sign In
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="space-y-4 mt-4">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">First Name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-slate-800 border-white/10 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Last Name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-slate-800 border-white/10 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-slate-800 border-white/10 text-white" required />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-800 border-white/10 text-white" required minLength={8} />
                <p className="text-xs text-gray-500">Minimum 8 characters</p>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-slate-800 border-white/10 text-white" required />
              </div>
              {displayError && <p className="text-red-400 text-sm">{displayError}</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-purple-600" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-gray-500 text-center pt-4 border-t border-white/10">
          <span className="text-cyan-400">Powered by Space Child Auth</span>
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default SpaceChildAuthModal;
