import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { useAuth } from '../../lib/auth-context';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Users, MessageSquare, AlertTriangle, BarChart3, Check, Trash2, Ban, Database, FileText } from 'lucide-react';
import { DataScraper } from './DataScraper';
import { SubjectTemplates } from './SubjectTemplates';

export function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'users' | 'templates' | 'scraper'>('overview');
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [userToBan, setUserToBan] = useState<{ id: string; email: string; banned: boolean } | null>(null);

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
        <ShieldCheck className="h-10 w-10 text-primary" />
        <h1 className="text-4xl md:text-5xl font-display font-black uppercase">Admin Dashboard</h1>
      </div>

      <div className="flex gap-2 mb-8 border-b-4 border-foreground pb-2">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('overview')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold"
          // @ts-ignore
          data-active={activeTab === 'overview'}
        >
          <BarChart3 className="mr-2 h-5 w-5" />
          Overview
        </Button>
        <Button
          variant={activeTab === 'moderation' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('moderation')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold"
          // @ts-ignore
          data-active={activeTab === 'moderation'}
        >
          <AlertTriangle className="mr-2 h-5 w-5" />
          Moderation
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold"
          // @ts-ignore
          data-active={activeTab === 'users'}
        >
          <Users className="mr-2 h-5 w-5" />
          Users
        </Button>
        <Button
          variant={activeTab === 'templates' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('templates')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold"
          // @ts-ignore
          data-active={activeTab === 'templates'}
        >
          <FileText className="mr-2 h-5 w-5" />
          Templates
        </Button>
        <Button
          variant={activeTab === 'scraper' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('scraper')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold"
          // @ts-ignore
          data-active={activeTab === 'scraper'}
        >
          <Database className="mr-2 h-5 w-5" />
          Data Scraping
        </Button>
      </div>

      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 border-4 border-foreground bg-primary text-primary-foreground shadow-neo">
            <Users className="h-6 w-6 mb-3" />
            <div className="text-4xl font-black mb-1">{stats.totalUsers}</div>
            <div className="text-sm font-bold uppercase">Total Users</div>
          </div>
          <div className="p-6 border-4 border-foreground bg-secondary text-secondary-foreground shadow-neo">
            <MessageSquare className="h-6 w-6 mb-3" />
            <div className="text-4xl font-black mb-1">{stats.totalReviews}</div>
            <div className="text-sm font-bold uppercase">Total Reviews</div>
          </div>
          <div className="p-6 border-4 border-foreground bg-destructive text-destructive-foreground shadow-neo">
            <AlertTriangle className="h-6 w-6 mb-3" />
            <div className="text-4xl font-black mb-1">{stats.flaggedReviews}</div>
            <div className="text-sm font-bold uppercase">Flagged Reviews</div>
          </div>
          <div className="p-6 border-4 border-foreground bg-accent text-accent-foreground shadow-neo">
            <ShieldCheck className="h-6 w-6 mb-3" />
            <div className="text-4xl font-black mb-1">{stats.totalUnits}</div>
            <div className="text-sm font-bold uppercase">Units Indexed</div>
          </div>
        </div>
      )}

      {activeTab === 'moderation' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-display font-black uppercase">Flagged Reviews Queue</h2>
          {!flaggedReviews || flaggedReviews.length === 0 ? (
            <div className="text-center py-12 border-4 border-foreground bg-muted shadow-neo">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-bold mb-2">No flagged reviews</h3>
              <p className="font-medium">
                Reviews flagged by users will appear here for moderation.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {flaggedReviews.map((review) => (
                <div key={review.id} className="p-5 border-4 border-foreground bg-card shadow-neo">
                   <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-mono font-black text-lg mr-2">{review.unitCode}</span>
                        <span className="text-sm font-bold">by {review.userEmail}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 border-3 border-green-600 text-green-600 hover:bg-green-600 hover:text-white font-bold"
                          onClick={() => moderateMutation.mutate({ id: review.id, action: 'restore' })}
                        >
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 border-3 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground font-bold"
                          onClick={() => moderateMutation.mutate({ id: review.id, action: 'remove' })}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </Button>
                      </div>
                   </div>
                   <p className="text-sm font-medium italic border-l-4 border-muted-foreground pl-4 py-2 bg-muted">"{review.reviewText}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-display font-black uppercase">User Management</h2>
          {!allUsers || allUsers.length === 0 ? (
            <div className="text-center py-12 border-4 border-foreground bg-muted shadow-neo">
              <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-lg font-bold mb-2">No users found</h3>
              <p className="font-medium">
                Users will appear here after registration.
              </p>
            </div>
          ) : (
            <div className="border-4 border-foreground overflow-hidden shadow-neo">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted font-bold border-b-4 border-foreground">
                  <tr>
                    <th className="px-4 py-4 uppercase">User</th>
                    <th className="px-4 py-4 uppercase">Role</th>
                    <th className="px-4 py-4 uppercase">Status</th>
                    <th className="px-4 py-4 text-right uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-3 divide-foreground">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/50">
                      <td className="px-4 py-4">
                        <div className="font-bold">{u.displayName || 'No Name'}</div>
                        <div className="text-xs font-medium text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-4 capitalize font-bold">{u.role}</td>
                      <td className="px-4 py-4">
                        {u.banned ? (
                          <span className="px-3 py-1 bg-destructive text-destructive-foreground text-xs font-black uppercase border-2 border-foreground">Banned</span>
                        ) : (
                          <span className="px-3 py-1 bg-green-500 text-white text-xs font-black uppercase border-2 border-foreground">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {u.role !== 'admin' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`border-2 font-bold ${u.banned ? "border-green-600 text-green-600 hover:bg-green-600 hover:text-white" : "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"}`}
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

      {activeTab === 'templates' && <SubjectTemplates />}

      {activeTab === 'scraper' && <DataScraper />}

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
