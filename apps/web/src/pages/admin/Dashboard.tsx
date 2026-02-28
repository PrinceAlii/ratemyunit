import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, Users, MessageSquare, AlertTriangle, BarChart3, Check, Trash2, Database, FileText, Megaphone } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { DataScraper } from './DataScraper';
import { SubjectTemplates } from './SubjectTemplates';
import { UserManagement } from './UserManagement';
import { SiteBannerSettingsPanel } from './SiteBannerSettings';

export function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'moderation' | 'users' | 'templates' | 'banner' | 'scraper'>('overview');

  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ totalUsers: number; totalReviews: number; flaggedReviews: number; totalUnits: number }>('/api/admin/stats'),
    enabled: activeTab === 'overview',
  });

  const { data: flaggedReviews } = useQuery({
    queryKey: ['admin', 'flagged'],
    queryFn: () => api.get<Array<{ id: string; unitCode: string; userEmail: string; reviewText: string }>>('/api/admin/reviews/flagged'),
    enabled: activeTab === 'moderation',
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

  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <ShieldCheck className="h-10 w-10 text-primary" />
        <h1 className="text-4xl md:text-5xl font-display font-black uppercase">Admin Dashboard</h1>
      </div>

      <div className="flex gap-2 mb-8 border-b-4 border-foreground pb-2 overflow-x-auto">
        <Button
          variant={activeTab === 'overview' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('overview')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold whitespace-nowrap"
          data-active={activeTab === 'overview'}
        >
          <BarChart3 className="mr-2 h-5 w-5" />
          Overview
        </Button>
        <Button
          variant={activeTab === 'moderation' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('moderation')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold whitespace-nowrap"
          data-active={activeTab === 'moderation'}
        >
          <AlertTriangle className="mr-2 h-5 w-5" />
          Moderation
        </Button>
        <Button
          variant={activeTab === 'users' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('users')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold whitespace-nowrap"
          data-active={activeTab === 'users'}
        >
          <Users className="mr-2 h-5 w-5" />
          Users
        </Button>
        <Button
          variant={activeTab === 'templates' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('templates')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold whitespace-nowrap"
          data-active={activeTab === 'templates'}
        >
          <FileText className="mr-2 h-5 w-5" />
          Templates
        </Button>
        <Button
          variant={activeTab === 'banner' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('banner')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold whitespace-nowrap"
          data-active={activeTab === 'banner'}
        >
          <Megaphone className="mr-2 h-5 w-5" />
          Site Banner
        </Button>
        <Button
          variant={activeTab === 'scraper' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('scraper')}
          className="border-3 border-transparent data-[active=true]:border-foreground font-bold whitespace-nowrap"
          data-active={activeTab === 'scraper'}
        >
          <Database className="mr-2 h-5 w-5" />
          Scraper
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

      {activeTab === 'users' && <UserManagement />}

      {activeTab === 'templates' && <SubjectTemplates />}

      {activeTab === 'banner' && <SiteBannerSettingsPanel />}

      {activeTab === 'scraper' && <DataScraper />}
    </div>
  );
}
