import { Switch, Route } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyboardShortcutsProvider } from "@/hooks/use-keyboard-shortcuts";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";

// Lazy load heavy pages for better initial load performance
const Studio = lazy(() => import("@/pages/studio"));
const VerifyEmail = lazy(() => import("@/pages/verify-email"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const Support = lazy(() => import("@/pages/support"));
const Settings = lazy(() => import("@/pages/settings"));
const Profile = lazy(() => import("@/pages/profile"));
const UserProfile = lazy(() => import("@/pages/user-profile"));
const Workspaces = lazy(() => import("@/pages/workspaces"));
const WorkspaceDetail = lazy(() => import("@/pages/workspace-detail"));
const Pricing = lazy(() => import("@/pages/pricing"));
const Billing = lazy(() => import("@/pages/billing"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/subscriptions"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/studio" component={Studio} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/support" component={Support} />
        <Route path="/settings" component={Settings} />
        <Route path="/profile" component={Profile} />
        <Route path="/u/:username" component={UserProfile} />
        <Route path="/workspaces" component={Workspaces} />
        <Route path="/workspaces/:id" component={WorkspaceDetail} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/billing" component={Billing} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/subscriptions" component={AdminSubscriptions} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardShortcutsProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </KeyboardShortcutsProvider>
    </QueryClientProvider>
  );
}

export default App;
