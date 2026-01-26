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
import { Database, AlertCircle, CheckCircle, Clock, Loader2, School, Search } from 'lucide-react';
import type { University } from '@ratemyunit/types';

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

export function DataScraper() {
  const queryClient = useQueryClient();

  // Form states.
  const [selectedUni, setSelectedUni] = useState('');
  const [singleCode, setSingleCode] = useState('');
  const [bulkCodes, setBulkCodes] = useState('');

  // Message states.
  const [singleMessage, setSingleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirmation dialog states.
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [pendingBulkCodes, setPendingBulkCodes] = useState<string[]>([]);

  // Fetch universities.
  const { data: universities } = useQuery({
    queryKey: ['universities'],
    queryFn: () => api.get<University[]>('/api/public/universities'),
  });

  // Fetch queue status with polling every 5 seconds.
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['admin', 'scrape', 'status'],
    queryFn: () => api.get<ScrapeStatus>('/api/admin/scrape/status'),
    refetchInterval: 5000,
  });

  // Fetch recent scrapes.
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

  // Single scrape mutation.
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

  // Bulk scrape mutation.
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

  // Discovery Scan mutation.
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

  // Handlers.
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
    </div>
  );
}
