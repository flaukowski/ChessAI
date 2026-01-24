/**
 * Admin Users Management Page
 * Searchable/filterable user table with actions
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/space-child-auth";
import {
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  UserCog,
  Ban,
  CheckCircle,
  Users,
  Crown,
  User,
  Shield,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Mail,
  Calendar,
  Clock,
} from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  tier: "free" | "pro" | "enterprise";
  status: "active" | "suspended" | "pending";
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  recordingsCount: number;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type TierFilter = "all" | "free" | "pro" | "enterprise";
type StatusFilter = "all" | "active" | "suspended" | "pending";

function TierBadge({ tier }: { tier: AdminUser["tier"] }) {
  switch (tier) {
    case "enterprise":
      return (
        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
          <Crown className="w-3 h-3 mr-1" />
          Enterprise
        </Badge>
      );
    case "pro":
      return (
        <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
          <Shield className="w-3 h-3 mr-1" />
          Pro
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
          <User className="w-3 h-3 mr-1" />
          Free
        </Badge>
      );
  }
}

function StatusBadge({ status }: { status: AdminUser["status"] }) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    case "suspended":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <Ban className="w-3 h-3 mr-1" />
          Suspended
        </Badge>
      );
    default:
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [newTier, setNewTier] = useState<AdminUser["tier"]>("free");

  const pageSize = 10;

  const {
    data: usersData,
    isLoading,
    error,
    refetch,
  } = useQuery<UsersResponse>({
    queryKey: ["admin", "users", { page, pageSize, search: searchQuery, tier: tierFilter, status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (searchQuery) params.set("search", searchQuery);
      if (tierFilter !== "all") params.set("tier", tierFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await authFetch(`/api/v1/admin/users?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
  });

  const changeTierMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: string }) => {
      const response = await authFetch(`/api/v1/admin/users/${userId}/tier`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!response.ok) {
        throw new Error("Failed to change user tier");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Tier Updated",
        description: "User tier has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setShowTierDialog(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      const response = await authFetch(`/api/v1/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: suspend ? "suspended" : "active" }),
      });
      if (!response.ok) {
        throw new Error(suspend ? "Failed to suspend user" : "Failed to reactivate user");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.suspend ? "User Suspended" : "User Reactivated",
        description: variables.suspend
          ? "User has been suspended and can no longer access the platform."
          : "User has been reactivated and can now access the platform.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setShowSuspendDialog(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleViewDetails = (user: AdminUser) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const handleChangeTier = (user: AdminUser) => {
    setSelectedUser(user);
    setNewTier(user.tier);
    setShowTierDialog(true);
  };

  const handleToggleSuspend = (user: AdminUser) => {
    setSelectedUser(user);
    setShowSuspendDialog(true);
  };

  const users = usersData?.users ?? [];
  const totalPages = usersData?.totalPages ?? 1;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-gray-400">Manage and monitor all registered users</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-white/10 text-gray-300 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800 border-white/10">
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-700 border-white/10 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v as TierFilter); setPage(1); }}>
                  <SelectTrigger className="w-[130px] bg-slate-700 border-white/10 text-white">
                    <SelectValue placeholder="Tier" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-white/10">
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}>
                  <SelectTrigger className="w-[130px] bg-slate-700 border-white/10 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-white/10">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" className="bg-cyan-500 hover:bg-cyan-600 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-slate-800 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Users
                </CardTitle>
                <CardDescription className="text-gray-400">
                  {usersData?.total ?? 0} total users
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-1/3 mb-2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : users.length > 0 ? (
              <>
                <div className="rounded-md border border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-gray-400">User</TableHead>
                        <TableHead className="text-gray-400">Tier</TableHead>
                        <TableHead className="text-gray-400">Status</TableHead>
                        <TableHead className="text-gray-400">Created</TableHead>
                        <TableHead className="text-gray-400">Last Login</TableHead>
                        <TableHead className="text-gray-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                                <span className="text-lg font-medium text-cyan-400">
                                  {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="text-white font-medium">
                                  {user.firstName && user.lastName
                                    ? `${user.firstName} ${user.lastName}`
                                    : "No name"}
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-400">{user.email}</p>
                                  {user.emailVerified && (
                                    <CheckCircle className="w-3 h-3 text-green-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TierBadge tier={user.tier} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={user.status} />
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {formatDate(user.createdAt)}
                          </TableCell>
                          <TableCell className="text-gray-400">
                            {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-700 border-white/10">
                                <DropdownMenuLabel className="text-gray-400">Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem
                                  onClick={() => handleViewDetails(user)}
                                  className="text-gray-300 focus:text-white focus:bg-white/10"
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleChangeTier(user)}
                                  className="text-gray-300 focus:text-white focus:bg-white/10"
                                >
                                  <UserCog className="w-4 h-4 mr-2" />
                                  Change Tier
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuItem
                                  onClick={() => handleToggleSuspend(user)}
                                  className={
                                    user.status === "suspended"
                                      ? "text-green-400 focus:text-green-300 focus:bg-green-500/10"
                                      : "text-red-400 focus:text-red-300 focus:bg-red-500/10"
                                  }
                                >
                                  {user.status === "suspended" ? (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Reactivate
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-4 h-4 mr-2" />
                                      Suspend
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-400">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, usersData?.total ?? 0)} of{" "}
                    {usersData?.total ?? 0} users
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="border-white/10 text-gray-300 hover:text-white disabled:opacity-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-gray-400 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                      className="border-white/10 text-gray-300 hover:text-white disabled:opacity-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No users found</p>
                <p className="text-gray-500 text-sm">Try adjusting your filters</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Details Dialog */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="bg-slate-800 border-white/10 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-white">User Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Detailed information about this user
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                  <span className="text-2xl font-medium text-cyan-400">
                    {(selectedUser.firstName?.[0] || selectedUser.email[0]).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-medium text-white">
                    {selectedUser.firstName && selectedUser.lastName
                      ? `${selectedUser.firstName} ${selectedUser.lastName}`
                      : "No name"}
                  </p>
                  <div className="flex items-center gap-2">
                    <TierBadge tier={selectedUser.tier} />
                    <StatusBadge status={selectedUser.status} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <Label className="text-gray-400 text-xs">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <p className="text-white text-sm">{selectedUser.email}</p>
                    {selectedUser.emailVerified && (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">User ID</Label>
                  <p className="text-white text-sm font-mono mt-1">{selectedUser.id}</p>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Created</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <p className="text-white text-sm">{formatDateTime(selectedUser.createdAt)}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Last Login</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <p className="text-white text-sm">
                      {selectedUser.lastLoginAt ? formatDateTime(selectedUser.lastLoginAt) : "Never"}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Recordings</Label>
                  <p className="text-white text-sm mt-1">{selectedUser.recordingsCount} recordings</p>
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Email Verified</Label>
                  <p className="text-white text-sm mt-1">
                    {selectedUser.emailVerified ? "Yes" : "No"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUserDetails(false)}
              className="border-white/10 text-gray-300"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Tier Dialog */}
      <Dialog open={showTierDialog} onOpenChange={setShowTierDialog}>
        <DialogContent className="bg-slate-800 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Change User Tier</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update the subscription tier for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-gray-300">New Tier</Label>
            <Select value={newTier} onValueChange={(v) => setNewTier(v as AdminUser["tier"])}>
              <SelectTrigger className="mt-2 bg-slate-700 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-white/10">
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTierDialog(false)}
              className="border-white/10 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedUser && changeTierMutation.mutate({ userId: selectedUser.id, tier: newTier })}
              disabled={changeTierMutation.isPending}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              {changeTierMutation.isPending ? "Updating..." : "Update Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend/Reactivate Dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent className="bg-slate-800 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedUser?.status === "suspended" ? "Reactivate User" : "Suspend User"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {selectedUser?.status === "suspended"
                ? `Are you sure you want to reactivate ${selectedUser?.email}? They will regain access to the platform.`
                : `Are you sure you want to suspend ${selectedUser?.email}? They will lose access to the platform.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSuspendDialog(false)}
              className="border-white/10 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedUser &&
                toggleSuspendMutation.mutate({
                  userId: selectedUser.id,
                  suspend: selectedUser.status !== "suspended",
                })
              }
              disabled={toggleSuspendMutation.isPending}
              className={
                selectedUser?.status === "suspended"
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }
            >
              {toggleSuspendMutation.isPending
                ? "Processing..."
                : selectedUser?.status === "suspended"
                ? "Reactivate"
                : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

export default AdminUsers;
