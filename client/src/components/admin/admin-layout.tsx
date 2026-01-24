/**
 * Admin Layout Component
 * Provides sidebar navigation and layout for admin pages
 */

import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useSpaceChildAuth } from "@/hooks/use-space-child-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Shield,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useState } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Subscriptions",
    href: "/admin/subscriptions",
    icon: CreditCard,
  },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, isLoading, logout } = useSpaceChildAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if user is admin
  const isAdmin = user && (user as any).role === "admin";

  useEffect(() => {
    // Redirect non-admin users
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isLoading, isAdmin, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-4">You do not have permission to access this area.</p>
          <Button onClick={() => navigate("/")} variant="outline">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-800 border-b border-white/10 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">Admin Panel</span>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-slate-800 border-r border-white/10 z-50 transition-all duration-300",
          sidebarCollapsed ? "w-16" : "w-64",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-cyan-400" />
                <span className="font-semibold text-white">Admin Panel</span>
              </div>
            )}
            {sidebarCollapsed && (
              <Shield className="w-6 h-6 text-cyan-400 mx-auto" />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex text-gray-400 hover:text-white"
            >
              <ChevronLeft
                className={cn(
                  "w-4 h-4 transition-transform",
                  sidebarCollapsed && "rotate-180"
                )}
              />
            </Button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-1 px-2">
              {navItems.map((item) => {
                const isActive = location === item.href ||
                  (item.href !== "/admin" && location.startsWith(item.href));

                return (
                  <Link key={item.href} href={item.href}>
                    <a
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                        isActive
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!sidebarCollapsed && <span>{item.title}</span>}
                    </a>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User Section */}
          <div className="border-t border-white/10 p-4">
            {!sidebarCollapsed && (
              <div className="mb-3">
                <p className="text-sm font-medium text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            )}
            <div className={cn("flex gap-2", sidebarCollapsed && "flex-col")}>
              <Button
                variant="ghost"
                size={sidebarCollapsed ? "icon" : "sm"}
                onClick={() => navigate("/")}
                className="text-gray-400 hover:text-white flex-1"
              >
                <ChevronLeft className="w-4 h-4" />
                {!sidebarCollapsed && <span className="ml-2">Back to App</span>}
              </Button>
              <Button
                variant="ghost"
                size={sidebarCollapsed ? "icon" : "icon"}
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "transition-all duration-300 min-h-screen pt-16 lg:pt-0",
          sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

export default AdminLayout;
