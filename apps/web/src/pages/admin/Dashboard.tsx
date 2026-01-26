import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { useAuth } from '../../lib/auth-context';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Users, MessageSquare, AlertTriangle, BarChart3, Check, Trash2, Ban, Database } from 'lucide-react';
import { DataScraper } from './DataScraper';

export function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'users' | 'scraper'>('overview');
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [userToBan, setUserToBan] = useState<{ id: string; email: string; banned: boolean } | null>(null);

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<any>('/api/admin/stats'),
    enabled: activeTab === 'overview',
  });

  const { data: flaggedReviews } = useQuery({
    queryKey: ['admin', 'flagged'],
    queryFn: () => api.get<any[]>('/api/admin/reviews/flagged'),
    enabled: activeTab === 'moderation',
  });

  const { data: allUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<any[]>('/api/admin/users'),
    enabled: activeTab === 'users',
  });

  // Mutations
  const moderateMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'remove' | 'restore' }) =>
      api.post(`/api/admin/reviews/${id}/moderate`, { action }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success(variables.action === 'remove' ? 'Review removed' : 'Review restored');
    },
    onError: (error: Error) => {
      toast.error(`Failed to moderate review: ${error.message}`);
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      api.post(`/api/admin/users/${id}/ban`, { banned }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setBanDialogOpen(false);
      setUserToBan(null);
      toast.success(variables.banned ? 'User banned successfully' : 'User unbanned successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update user status: ${error.message}`);
      setBanDialogOpen(false);
    },
  });

  const handleBanClick = (userId: string, userEmail: string, currentBanStatus: boolean) => {
    setUserToBan({ id: userId, email: userEmail, banned: currentBanStatus });
    setBanDialogOpen(true);
  };

  const confirmBan = () => {
    if (userToBan) {
      banMutation.mutate({ id: userToBan.id, banned: !userToBan.banned });
    }
  };

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="flex gap-4 mb-8 border-b">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('overview')}
          className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
          // @ts-ignore
          data-active={activeTab === 'overview'}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Overview
        </Button>
        <Button
          variant={activeTab === 'moderation' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('moderation')}
          className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
          // @ts-ignore
          data-active={activeTab === 'moderation'}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          Moderation
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
          // @ts-ignore
          data-active={activeTab === 'users'}
        >
          <Users className="mr-2 h-4 w-4" />
          Users
        </Button>
        <Button
          variant={activeTab === 'scraper' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('scraper')}
          className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
          // @ts-ignore
          data-active={activeTab === 'scraper'}
        >
          <Database className="mr-2 h-4 w-4" />
          Data Scraping
        </Button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 border rounded-lg bg-card">
            <Users className="h-5 w-5 mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </div>
          <div className="p-6 border rounded-lg bg-card">
            <MessageSquare className="h-5 w-5 mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats.totalReviews}</div>
            <div className="text-sm text-muted-foreground">Total Reviews</div>
          </div>
          <div className="p-6 border rounded-lg bg-card">
            <AlertTriangle className="h-5 w-5 mb-2 text-destructive" />
            <div className="text-2xl font-bold text-destructive">{stats.flaggedReviews}</div>
            <div className="text-sm text-muted-foreground">Flagged Reviews</div>
          </div>
          <div className="p-6 border rounded-lg bg-card">
            <ShieldCheck className="h-5 w-5 mb-2 text-primary" />
            <div className="text-2xl font-bold">{stats.totalUnits}</div>
            <div className="text-sm text-muted-foreground">Units Indexed</div>
          </div>
        </div>
      )}

      {/* Moderation Tab */}
      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Flagged Reviews Queue</h2>
          {!flaggedReviews || flaggedReviews.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No flagged reviews</h3>
              <p className="text-muted-foreground">
                Reviews flagged by users will appear here for moderation.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {flaggedReviews.map((review) => (
                <div key={review.id} className="p-4 border rounded-lg bg-card">
                   <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold mr-2">{review.unitCode}</span>
                        <span className="text-sm text-muted-foreground">by {review.userEmail}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-green-600"
                          onClick={() => moderateMutation.mutate({ id: review.id, action: 'restore' })}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-destructive"
                          onClick={() => moderateMutation.mutate({ id: review.id, action: 'remove' })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                   </div>
                   <p className="text-sm italic border-l-4 pl-3 py-1 bg-muted/30">"{review.reviewText}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">User Management</h2>
          {!allUsers || allUsers.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-muted/10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No users found</h3>
              <p className="text-muted-foreground">
                Users will appear here after registration.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div>{u.displayName || 'No Name'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 capitalize">{u.role}</td>
                      <td className="px-4 py-3">
                        {u.banned ? (
                          <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs">Banned</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.role !== 'admin' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className={u.banned ? "text-green-600" : "text-destructive"}
                            onClick={() => handleBanClick(u.id, u.email, u.banned)}
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            {u.banned ? 'Unban' : 'Ban'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Data Scraping Tab */}
      {activeTab === 'scraper' && <DataScraper />}

      {/* Ban Confirmation Dialog */}
      <ConfirmDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        title={userToBan?.banned ? 'Unban User' : 'Ban User'}
        description={
          userToBan?.banned
            ? `Are you sure you want to unban ${userToBan?.email}? They will be able to access the platform again.`
            : `Are you sure you want to ban ${userToBan?.email}? They will no longer be able to access the platform.`
        }
        confirmText={userToBan?.banned ? 'Unban' : 'Ban'}
        onConfirm={confirmBan}
        variant={userToBan?.banned ? 'default' : 'destructive'}
      />
    </div>
  );
}
