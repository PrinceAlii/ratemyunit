import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Users, Ban, Trash2, History, Monitor, Smartphone, Tablet, Globe } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  banned: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastIp: string | null;
}

interface TelemetryLog {
  id: string;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  deviceType: string;
  createdAt: string;
}

export function UserManagement() {
  const queryClient = useQueryClient();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get<User[]>('/api/admin/users'),
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['admin', 'users', selectedUser?.id, 'telemetry'],
    queryFn: () => api.get<TelemetryLog[]>(`/api/admin/users/${selectedUser?.id}/telemetry`),
    enabled: !!selectedUser && logsDialogOpen,
  });

  const banMutation = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      api.post(`/api/admin/users/${id}/ban`, { banned }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setBanDialogOpen(false);
      setSelectedUser(null);
      toast.success(variables.banned ? 'User banned successfully' : 'User unbanned successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update user status: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      toast.success('User deleted permanently');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete user: ${error.message}`);
    },
  });

  const handleAction = (user: User, action: 'ban' | 'delete' | 'logs') => {
    setSelectedUser(user);
    if (action === 'ban') setBanDialogOpen(true);
    if (action === 'delete') setDeleteDialogOpen(true);
    if (action === 'logs') setLogsDialogOpen(true);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone className="h-4 w-4" />;
      case 'tablet': return <Tablet className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  if (isLoading) return <div className="p-8 text-center font-bold">Loading users...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-display font-black uppercase">User Management</h2>
      </div>

      {!users || users.length === 0 ? (
        <div className="text-center py-12 border-4 border-foreground bg-muted shadow-neo">
          <Users className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-bold mb-2">No users found</h3>
        </div>
      ) : (
        <div className="border-4 border-foreground overflow-hidden shadow-neo bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted font-bold border-b-4 border-foreground">
                <tr>
                  <th className="px-4 py-4 uppercase">User Info</th>
                  <th className="px-4 py-4 uppercase">Status / Role</th>
                  <th className="px-4 py-4 uppercase">Last Activity</th>
                  <th className="px-4 py-4 text-right uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-3 divide-foreground">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-black text-base">{u.displayName || 'No Name'}</div>
                      <div className="text-xs font-bold text-muted-foreground">{u.email}</div>
                      <div className="text-[10px] mt-1 font-mono opacity-50">{u.id}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-black uppercase border-2 border-foreground">
                          {u.role}
                        </span>
                        {u.banned ? (
                          <span className="px-2 py-0.5 bg-destructive text-destructive-foreground text-[10px] font-black uppercase border-2 border-foreground">Banned</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-black uppercase border-2 border-foreground">Active</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {u.lastLoginAt ? (
                        <div className="space-y-1">
                          <div className="font-bold text-xs">{format(new Date(u.lastLoginAt), 'MMM d, yyyy HH:mm')}</div>
                          <div className="flex items-center gap-1 text-[10px] font-mono bg-muted px-1.5 py-0.5 border border-foreground/20 rounded w-fit">
                            <Globe className="h-2.5 w-2.5" /> {u.lastIp}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Never logged in</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-3 border-foreground h-9 w-9 p-0"
                          onClick={() => handleAction(u, 'logs')}
                          title="View Logs"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        
                        {u.role !== 'admin' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className={`border-3 h-9 w-9 p-0 ${u.banned ? "border-green-600 text-green-600" : "border-amber-500 text-amber-500"}`}
                              onClick={() => handleAction(u, 'ban')}
                              title={u.banned ? 'Unban User' : 'Ban User'}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-3 border-destructive text-destructive h-9 w-9 p-0 hover:bg-destructive hover:text-white"
                              onClick={() => handleAction(u, 'delete')}
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col border-4 border-foreground shadow-neo">
          <DialogHeader className="border-b-4 border-foreground pb-4 bg-secondary">
            <DialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
              <History className="h-6 w-6" />
              Activity Logs: {selectedUser?.email}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
            {logsLoading ? (
              <p className="text-center py-8 font-bold">Loading telemetry...</p>
            ) : !logs || logs.length === 0 ? (
              <p className="text-center py-8 italic">No activity logs found for this user.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-4 border-3 border-foreground bg-card shadow-neo-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-black text-sm">
                      <span className="bg-primary px-2 py-0.5 border-2 border-foreground text-[10px]">IP</span>
                      {log.ipAddress}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted border-2 border-foreground/50">
                        {getDeviceIcon(log.deviceType)} {log.browser}
                      </span>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted border-2 border-foreground/50">
                        {log.os}
                      </span>
                      {log.device !== 'Desktop/Unknown' && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-muted border-2 border-foreground/50 text-primary">
                           {log.device}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black">{format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}</div>
                    <div className="text-[9px] font-medium opacity-60 truncate max-w-[200px]" title={log.userAgent}>
                      {log.userAgent}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        title={selectedUser?.banned ? 'Unban User' : 'Ban User'}
        description={`Are you sure you want to ${selectedUser?.banned ? 'unban' : 'ban'} ${selectedUser?.email}?`}
        confirmText={selectedUser?.banned ? 'Unban' : 'Ban'}
        onConfirm={() => banMutation.mutate({ id: selectedUser!.id, banned: !selectedUser!.banned })}
        variant={selectedUser?.banned ? 'default' : 'destructive'}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete User Permanently"
        description={
          <div className="space-y-2">
            <p className="font-bold text-destructive">WARNING: This action cannot be undone.</p>
            <p>This will permanently delete <strong>{selectedUser?.email}</strong> and all their reviews, votes, and activity history.</p>
            <p>The email will become available for new registration.</p>
          </div>
        }
        confirmText="Delete Permanently"
        onConfirm={() => deleteMutation.mutate(selectedUser!.id)}
        variant="destructive"
      />
    </div>
  );
}
