import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { LoadingSpinner } from '../../components/ui/loading-spinner';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Database, AlertCircle, CheckCircle, Clock, Loader2, School, Search, Pause, Play, List, Trash2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { University } from '@ratemyunit/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '../../components/ui/alert-dialog';

interface ScrapeStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

interface BulkScrapeResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ code: string; error: string }>;
}

interface QueueStatus {
  paused: boolean;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

interface Job {
  id: string;
  unitCode: string;
  universityId: string;
  universityName?: string;
  attempts: number;
  state: 'waiting' | 'active' | 'completed' | 'failed';
  createdAt: string;
  processedAt?: string;
  error?: string;
}

interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
}

type JobState = 'waiting' | 'active' | 'completed' | 'failed';

export function DataScraper() {
  const queryClient = useQueryClient();

  const [selectedUni, setSelectedUni] = useState('');
  const [singleCode, setSingleCode] = useState('');
  const [bulkCodes, setBulkCodes] = useState('');

  const [singleMessage, setSingleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [pendingBulkCodes, setPendingBulkCodes] = useState<string[]>([]);

  // Queue management state
  const [jobsDialogOpen, setJobsDialogOpen] = useState(false);
  const [selectedJobState, setSelectedJobState] = useState<JobState>('waiting');
  const [currentPage, setCurrentPage] = useState(1);
  const [clearQueueDialogOpen, setClearQueueDialogOpen] = useState(false);

  const { data: universities } = useQuery({
    queryKey: ['universities'],
    queryFn: () => api.get<University[]>('/api/public/universities'),
  });

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['admin', 'scrape', 'status'],
    queryFn: () => api.get<ScrapeStatus>('/api/admin/queue-stats'),
    refetchInterval: 5000,
  });

  // Queue status query
  const { data: queueStatus, isLoading: queueStatusLoading } = useQuery({
    queryKey: ['admin', 'queue', 'status'],
    queryFn: () => api.get<QueueStatus>('/api/admin/queue/status'),
    refetchInterval: 5000,
  });

  // Jobs query - only fetch when dialog is open
  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['admin', 'queue', 'jobs', selectedJobState, currentPage],
    queryFn: () => api.get<JobsResponse>('/api/admin/queue/jobs', {
      state: selectedJobState,
      page: currentPage,
      pageSize: 20,
    }),
    enabled: jobsDialogOpen,
    refetchInterval: jobsDialogOpen ? 5000 : false,
  });

  const { data: recentScrapes } = useQuery({
    queryKey: ['admin', 'recent-scrapes'],
    queryFn: async () => {
      const response = await api.get<Array<{
        id: string;
        unitCode: string;
        unitName: string;
        scrapedAt: string | null;
        universityName?: string;
      }>>('/api/units/search', { limit: 10, sort: 'recent' });
      return response;
    },
        refetchInterval: 10000,
      });
    
      const singleMutation = useMutation({
        mutationFn: (code: string) => api.post('/api/admin/scrape', {
          unitCode: code,
          universityId: selectedUni || undefined 
        }),
        onSuccess: (_, code) => {
          setSingleMessage({ type: 'success', text: `Scrape job queued for unit ${code}` });
          toast.success(`Scrape job queued for unit ${code}`);
          setSingleCode('');
          queryClient.invalidateQueries({ queryKey: ['admin', 'scrape', 'status'] });
        },
        onError: (error: Error) => {
          setSingleMessage({ type: 'error', text: error.message });
          toast.error(`Scrape failed: ${error.message}`);
        },
      });
    
      const bulkMutation = useMutation({
        mutationFn: (codes: string[]) => api.post<BulkScrapeResult>('/api/admin/scrape/bulk', {
          unitCodes: codes,
          universityId: selectedUni || undefined
        }),
        onSuccess: (data) => {
          const message = `Scraped ${data.successful}/${data.total} units successfully. ${data.failed} failed.`;
          setBulkMessage({ type: 'success', text: message });
          toast.success(message);
          setBulkCodes('');
          setBulkDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['admin'] });
        },
        onError: (error: Error) => {
          setBulkMessage({ type: 'error', text: error.message });
          toast.error(`Bulk scrape failed: ${error.message}`);
          setBulkDialogOpen(false);
        },
      });
    
      const scanMutation = useMutation({
    mutationFn: (uniId: string) => api.post(`/api/admin/university/${uniId}/scan`, {}),
    onSuccess: () => {
      const message = `Discovery scan queued. The system will now crawl the university site for unit codes.`;
      setScanMessage({ type: 'success', text: message });
      toast.success(message);
      setScanDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'scrape', 'status'] });
    },
    onError: (error: Error) => {
      setScanMessage({ type: 'error', text: error.message });
      toast.error(`Scan failed: ${error.message}`);
      setScanDialogOpen(false);
    },
  });

  // Queue control mutations
  const pauseQueueMutation = useMutation({
    mutationFn: () => api.post('/api/admin/queue/pause', {}),
    onSuccess: () => {
      toast.success('Queue paused successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue', 'status'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to pause queue: ${error.message}`);
    },
  });

  const resumeQueueMutation = useMutation({
    mutationFn: () => api.post('/api/admin/queue/resume', {}),
    onSuccess: () => {
      toast.success('Queue resumed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue', 'status'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to resume queue: ${error.message}`);
    },
  });

  const clearQueueMutation = useMutation({
    mutationFn: () => api.post('/api/admin/queue/clear', { confirm: true }),
    onSuccess: () => {
      toast.success('Queue cleared successfully');
      setClearQueueDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'scrape', 'status'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to clear queue: ${error.message}`);
      setClearQueueDialogOpen(false);
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/api/admin/queue/jobs/${jobId}/cancel`, {}),
    onSuccess: () => {
      toast.success('Job cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['admin', 'queue'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel job: ${error.message}`);
    },
  });

  const handleSingleScrape = () => {
    if (!singleCode.trim()) {
      setSingleMessage({ type: 'error', text: 'Please enter a subject code' });
      return;
    }
    setSingleMessage(null);
    singleMutation.mutate(singleCode.trim());
  };

  const handleBulkScrape = () => {
    const codes = bulkCodes
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (codes.length === 0) {
      setBulkMessage({ type: 'error', text: 'Please enter at least one subject code' });
      return;
    }

    if (codes.length > 100) {
      setBulkMessage({ type: 'error', text: 'Maximum 100 codes allowed' });
      return;
    }

    setBulkMessage(null);
    setPendingBulkCodes(codes);
    setBulkDialogOpen(true);
  };

  const confirmBulkScrape = () => {
    bulkMutation.mutate(pendingBulkCodes);
  };

  const handleScanClick = () => {
    if (!selectedUni) {
        toast.error("Please select a target university first");
        return;
    }
    setScanMessage(null);
    setScanDialogOpen(true);
  };

  const confirmScan = () => {
    if (selectedUni) {
        scanMutation.mutate(selectedUni);
    }
  };

  // Queue control handlers
  const handlePauseResume = () => {
    if (queueStatus?.paused) {
      resumeQueueMutation.mutate();
    } else {
      pauseQueueMutation.mutate();
    }
  };

  const handleClearQueue = () => {
    setClearQueueDialogOpen(true);
  };

  const confirmClearQueue = () => {
    clearQueueMutation.mutate();
  };

  const handleViewJobs = () => {
    setJobsDialogOpen(true);
    setCurrentPage(1);
  };

  const handleJobStateChange = (state: JobState) => {
    setSelectedJobState(state);
    setCurrentPage(1);
  };

  const handleCancelJob = (jobId: string) => {
    cancelJobMutation.mutate(jobId);
  };

  const totalPages = jobsData ? Math.ceil(jobsData.total / 20) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-primary" />
        <h2 className="text-3xl font-display font-black uppercase">Data Scraper</h2>
      </div>

      {/* Scraping Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 border-4 border-foreground bg-primary text-primary-foreground shadow-neo">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-5 w-5" />
            <span className="text-sm font-bold uppercase">Active Jobs</span>
          </div>
          <div className="text-4xl font-black">{statusLoading ? '-' : status?.active || 0}</div>
        </div>

        <div className="p-5 border-4 border-foreground bg-secondary text-secondary-foreground shadow-neo">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5" />
            <span className="text-sm font-bold uppercase">Queued Jobs</span>
          </div>
          <div className="text-4xl font-black">{statusLoading ? '-' : status?.waiting || 0}</div>
        </div>

        <div className="p-5 border-4 border-foreground bg-green-500 text-white shadow-neo">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-bold uppercase">Completed</span>
          </div>
          <div className="text-4xl font-black">{statusLoading ? '-' : status?.completed || 0}</div>
        </div>

        <div className="p-5 border-4 border-foreground bg-destructive text-destructive-foreground shadow-neo">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-bold uppercase">Failed</span>
          </div>
          <div className="text-4xl font-black">{statusLoading ? '-' : status?.failed || 0}</div>
        </div>
      </div>

      {/* Queue Management Controls */}
      <div className="p-6 border-4 border-foreground bg-card shadow-neo">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-display font-black uppercase flex items-center gap-2">
            <List className="h-6 w-6" />
            Queue Management
          </h3>
          {!queueStatusLoading && queueStatus && (
            <div
              className={`px-4 py-2 border-3 border-foreground font-bold text-sm uppercase ${
                queueStatus.paused
                  ? 'bg-yellow-500 text-white'
                  : 'bg-green-500 text-white'
              }`}
            >
              {queueStatus.paused ? 'Paused' : 'Active'}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handlePauseResume}
            disabled={pauseQueueMutation.isPending || resumeQueueMutation.isPending || queueStatusLoading}
            variant="secondary"
            className="h-12 border-4 font-bold"
          >
            {pauseQueueMutation.isPending || resumeQueueMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                {queueStatus?.paused ? 'Resuming...' : 'Pausing...'}
              </>
            ) : (
              <>
                {queueStatus?.paused ? (
                  <Play className="h-5 w-5 mr-2" />
                ) : (
                  <Pause className="h-5 w-5 mr-2" />
                )}
                {queueStatus?.paused ? 'Resume Queue' : 'Pause Queue'}
              </>
            )}
          </Button>

          <Button
            onClick={handleViewJobs}
            variant="outline"
            className="h-12 border-4 font-bold"
          >
            <List className="h-5 w-5 mr-2" />
            View Jobs
          </Button>

          <Button
            onClick={handleClearQueue}
            disabled={clearQueueMutation.isPending}
            variant="destructive"
            className="h-12 border-4 font-bold"
          >
            {clearQueueMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-5 w-5 mr-2" />
                Clear Queue
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Global University Selector */}
      <div className="p-6 border-4 border-foreground bg-card shadow-neo">
        <div className="space-y-2">
          <Label className="font-bold uppercase text-sm flex items-center gap-2">
            <School className="h-4 w-4" />
            Target University
          </Label>
          <select
            className="flex h-12 w-full border-3 border-input bg-background px-3 py-2 text-sm font-medium shadow-neo-sm focus:outline-none focus:shadow-neo"
            value={selectedUni}
            onChange={(e) => setSelectedUni(e.target.value)}
          >
            <option value="">-- Default (UTS) --</option>
            {universities?.map((uni) => (
              <option key={uni.id} value={uni.id}>
                {uni.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground font-medium">
            Select a university to apply scraping actions to. Leave empty for default (UTS).
          </p>
        </div>
      </div>

      {/* Discovery Scanner (NEW) */}
      <div className="p-6 border-4 border-foreground bg-card shadow-neo">
        <h3 className="text-xl font-display font-black uppercase mb-4 flex items-center gap-2">
            <Search className="h-6 w-6" />
            Auto-Discovery Scanner
        </h3>
        <p className="mb-4 text-sm font-medium">
            This tool will automatically crawl the selected university's handbook to discover unit codes and add them to the scrape queue.
        </p>
        
        {!selectedUni && (
            <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 text-sm font-bold">
                Select a university above to enable the scanner.
            </div>
        )}

        <Button 
            onClick={handleScanClick} 
            disabled={scanMutation.isPending || !selectedUni} 
            className="h-12 border-4 font-bold bg-accent text-accent-foreground hover:bg-accent/90"
        >
            {scanMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Scanning...
              </>
            ) : (
              'Start Discovery Scan'
            )}
        </Button>

        {scanMessage && (
            <div
              className={`mt-4 p-4 text-sm font-bold border-3 ${
                scanMessage.type === 'success'
                  ? 'bg-green-100 text-green-800 border-green-700'
                  : 'bg-red-100 text-red-800 border-red-700'
              }`}
            >
              {scanMessage.text}
            </div>
        )}
      </div>

      {/* Single Subject Scraper */}
      <div className="p-6 border-4 border-foreground bg-card shadow-neo">
        <h3 className="text-xl font-display font-black uppercase mb-4">Single Subject Scraper</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="single-code" className="font-bold uppercase text-sm">Subject Code</Label>
            <Input
              id="single-code"
              placeholder="e.g., 31251 or FIT1008"
              value={singleCode}
              onChange={(e) => setSingleCode(e.target.value)}
              disabled={singleMutation.isPending}
              className="h-12 border-3"
            />
          </div>
          <Button onClick={handleSingleScrape} disabled={singleMutation.isPending} className="h-12 border-4 font-bold">
            {singleMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Queuing...
              </>
            ) : (
              'Scrape Subject'
            )}
          </Button>
          {singleMessage && (
            <div
              className={`p-4 text-sm font-bold border-3 ${
                singleMessage.type === 'success'
                  ? 'bg-green-100 text-green-800 border-green-700'
                  : 'bg-red-100 text-red-800 border-red-700'
              }`}
            >
              {singleMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Scraper */}
      <div className="p-6 border-4 border-foreground bg-card shadow-neo">
        <h3 className="text-xl font-display font-black uppercase mb-4">Bulk Scraper</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-codes" className="font-bold uppercase text-sm">Subject Codes (comma-separated, max 100)</Label>
            <Textarea
              id="bulk-codes"
              placeholder="e.g., 31251, 31252, 31271"
              value={bulkCodes}
              onChange={(e) => setBulkCodes(e.target.value)}
              disabled={bulkMutation.isPending}
              rows={4}
              className="border-3 font-mono"
            />
          </div>
          <Button onClick={handleBulkScrape} disabled={bulkMutation.isPending} className="h-12 border-4 font-bold">
            {bulkMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Scraping...
              </>
            ) : (
              'Scrape Multiple'
            )}
          </Button>
          {bulkMutation.isPending && (
            <div className="p-4 bg-blue-100 border-3 border-blue-700">
              <LoadingSpinner className="h-5 w-5" />
              <p className="text-sm font-bold text-blue-800 mt-2">Scraping in progress. This may take a few minutes...</p>
            </div>
          )}
          {bulkMessage && (
            <div
              className={`p-4 text-sm font-bold border-3 ${
                bulkMessage.type === 'success'
                  ? 'bg-green-100 text-green-800 border-green-700'
                  : 'bg-red-100 text-red-800 border-red-700'
              }`}
            >
              {bulkMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Recent Scrapes Table */}
      <div className="p-6 border-4 border-foreground bg-card shadow-neo">
        <h3 className="text-xl font-display font-black uppercase mb-4">Recent Scrapes</h3>
        {!recentScrapes ? (
          <LoadingSpinner />
        ) : recentScrapes.length === 0 ? (
          <p className="text-center py-8 font-bold">No scrapes yet.</p>
        ) : (
          <div className="border-3 border-foreground overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted font-bold border-b-3 border-foreground">
                <tr>
                  <th className="px-4 py-4 uppercase">Code</th>
                  <th className="px-4 py-4 uppercase">Name</th>
                  <th className="px-4 py-4 uppercase">University</th>
                  <th className="px-4 py-4 uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y-3 divide-foreground">
                {recentScrapes.map((scrape) => (
                  <tr key={scrape.id} className="hover:bg-muted/50">
                    <td className="px-4 py-4 font-mono font-bold">{scrape.unitCode}</td>
                    <td className="px-4 py-4 font-medium">{scrape.unitName}</td>
                    <td className="px-4 py-4 font-medium">{scrape.universityName || 'Unknown'}</td>
                    <td className="px-4 py-4 font-medium text-muted-foreground">
                      {scrape.scrapedAt
                        ? formatDistanceToNow(new Date(scrape.scrapedAt), { addSuffix: true })
                        : 'Not scraped'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Scrape Confirmation Dialog */}
      <ConfirmDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        title="Confirm Bulk Scrape"
        description={`Are you sure you want to scrape ${pendingBulkCodes.length} subject${pendingBulkCodes.length !== 1 ? 's' : ''}? This may take several minutes.`}
        confirmText="Start Scraping"
        onConfirm={confirmBulkScrape}
      />

       {/* Scan Confirmation Dialog */}
       <ConfirmDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        title="Start Discovery Scan?"
        description="This will start a crawler that visits the university handbook page and looks for links matching the unit code pattern. Found units will be automatically added to the scrape queue. This process runs in the background."
        confirmText="Start Scan"
        onConfirm={confirmScan}
      />

      {/* Clear Queue Confirmation Dialog */}
      <ConfirmDialog
        open={clearQueueDialogOpen}
        onOpenChange={setClearQueueDialogOpen}
        title="Clear Queue?"
        description={`Are you sure you want to clear the queue? This will remove ${status?.waiting || 0} waiting job${(status?.waiting || 0) !== 1 ? 's' : ''} and cannot be undone.`}
        confirmText="Clear Queue"
        variant="destructive"
        onConfirm={confirmClearQueue}
      />

      {/* Jobs Dialog */}
      <AlertDialog open={jobsDialogOpen} onOpenChange={setJobsDialogOpen}>
        <AlertDialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <List className="h-6 w-6" />
              Queue Jobs
            </AlertDialogTitle>
            <AlertDialogDescription>
              View and manage jobs in the scraping queue
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b-3 border-foreground pb-2">
            {(['waiting', 'active', 'completed', 'failed'] as JobState[]).map((state) => (
              <button
                key={state}
                onClick={() => handleJobStateChange(state)}
                className={`px-4 py-2 font-bold text-sm uppercase border-3 border-foreground transition-all ${
                  selectedJobState === state
                    ? 'bg-primary text-primary-foreground shadow-neo'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {state}
                {queueStatus && (
                  <span className="ml-2 text-xs">
                    ({queueStatus.counts[state]})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Jobs Table */}
          <div className="flex-1 overflow-y-auto">
            {jobsLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner className="h-8 w-8" />
              </div>
            ) : !jobsData || jobsData.jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground font-bold">
                No {selectedJobState} jobs found
              </div>
            ) : (
              <div className="border-3 border-foreground">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted font-bold border-b-3 border-foreground">
                    <tr>
                      <th className="px-4 py-3 uppercase">Job ID</th>
                      <th className="px-4 py-3 uppercase">Unit Code</th>
                      <th className="px-4 py-3 uppercase">University</th>
                      <th className="px-4 py-3 uppercase">Attempts</th>
                      <th className="px-4 py-3 uppercase">Timestamp</th>
                      {(selectedJobState === 'waiting' || selectedJobState === 'active') && (
                        <th className="px-4 py-3 uppercase">Actions</th>
                      )}
                      {selectedJobState === 'failed' && (
                        <th className="px-4 py-3 uppercase">Error</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y-3 divide-foreground">
                    {jobsData.jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-mono text-xs">{job.id.substring(0, 8)}...</td>
                        <td className="px-4 py-3 font-mono font-bold">{job.unitCode}</td>
                        <td className="px-4 py-3 font-medium">{job.universityName || 'Unknown'}</td>
                        <td className="px-4 py-3 font-medium">{job.attempts}</td>
                        <td className="px-4 py-3 font-medium text-muted-foreground text-xs">
                          {formatDistanceToNow(new Date(job.processedAt || job.createdAt), { addSuffix: true })}
                        </td>
                        {(selectedJobState === 'waiting' || selectedJobState === 'active') && (
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelJob(job.id)}
                              disabled={cancelJobMutation.isPending}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </td>
                        )}
                        {selectedJobState === 'failed' && (
                          <td className="px-4 py-3 text-xs text-red-700 font-medium max-w-xs truncate">
                            {job.error || 'Unknown error'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {jobsData && jobsData.total > 20 && (
            <div className="flex items-center justify-between border-t-3 border-foreground pt-4">
              <div className="text-sm font-medium text-muted-foreground">
                Page {currentPage} of {totalPages} ({jobsData.total} total)
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
