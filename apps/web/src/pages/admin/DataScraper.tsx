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
import { Database, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';

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

interface RangeScrapeResult extends BulkScrapeResult {
  durationMs: number;
}

export function DataScraper() {
  const queryClient = useQueryClient();

  // Form states.
  const [singleCode, setSingleCode] = useState('');
  const [bulkCodes, setBulkCodes] = useState('');
  const [startCode, setStartCode] = useState('');
  const [endCode, setEndCode] = useState('');

  // Message states.
  const [singleMessage, setSingleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rangeMessage, setRangeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirmation dialog states.
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [pendingBulkCodes, setPendingBulkCodes] = useState<string[]>([]);
  const [pendingRange, setPendingRange] = useState<{ start: string; end: string } | null>(null);

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
      }>>('/api/units/search', { limit: 10, sort: 'recent' });
      return response;
    },
    refetchInterval: 10000,
  });

  // Single scrape mutation.
  const singleMutation = useMutation({
    mutationFn: (code: string) => api.post('/api/admin/scrape', { unitCode: code }),
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
    mutationFn: (codes: string[]) => api.post<BulkScrapeResult>('/api/admin/scrape/bulk', { unitCodes: codes }),
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

  // Range scrape mutation.
  const rangeMutation = useMutation({
    mutationFn: ({ start, end }: { start: string; end: string }) =>
      api.post<RangeScrapeResult>('/api/admin/scrape/range', { startCode: start, endCode: end }),
    onSuccess: (data) => {
      const durationSec = Math.round(data.durationMs / 1000);
      const message = `Scraped ${data.successful}/${data.total} units in ${durationSec}s. ${data.failed} failed.`;
      setRangeMessage({ type: 'success', text: message });
      toast.success(message);
      setStartCode('');
      setEndCode('');
      setRangeDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error: Error) => {
      setRangeMessage({ type: 'error', text: error.message });
      toast.error(`Range scrape failed: ${error.message}`);
      setRangeDialogOpen(false);
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

  const handleRangeScrape = () => {
    if (!startCode.trim() || !endCode.trim()) {
      setRangeMessage({ type: 'error', text: 'Please enter both start and end codes' });
      return;
    }

    if (!/^\d{5}$/.test(startCode.trim()) || !/^\d{5}$/.test(endCode.trim())) {
      setRangeMessage({ type: 'error', text: 'Codes must be 5 digits' });
      return;
    }

    setRangeMessage(null);
    setPendingRange({ start: startCode.trim(), end: endCode.trim() });
    setRangeDialogOpen(true);
  };

  const confirmRangeScrape = () => {
    if (pendingRange) {
      rangeMutation.mutate(pendingRange);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Data Scraper</h2>
      </div>

      {/* Scraping Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Active Jobs</span>
          </div>
          <div className="text-2xl font-bold">{statusLoading ? '-' : status?.active || 0}</div>
        </div>

        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Queued Jobs</span>
          </div>
          <div className="text-2xl font-bold">{statusLoading ? '-' : status?.waiting || 0}</div>
        </div>

        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Completed</span>
          </div>
          <div className="text-2xl font-bold">{statusLoading ? '-' : status?.completed || 0}</div>
        </div>

        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-muted-foreground">Failed</span>
          </div>
          <div className="text-2xl font-bold">{statusLoading ? '-' : status?.failed || 0}</div>
        </div>
      </div>

      {/* Single Subject Scraper */}
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold mb-4">Single Subject Scraper</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="single-code">Subject Code</Label>
            <Input
              id="single-code"
              placeholder="e.g., 31251"
              value={singleCode}
              onChange={(e) => setSingleCode(e.target.value)}
              disabled={singleMutation.isPending}
            />
          </div>
          <Button onClick={handleSingleScrape} disabled={singleMutation.isPending}>
            {singleMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Queuing...
              </>
            ) : (
              'Scrape Subject'
            )}
          </Button>
          {singleMessage && (
            <div
              className={`p-3 rounded-md text-sm ${
                singleMessage.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {singleMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Scraper */}
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold mb-4">Bulk Scraper</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-codes">Subject Codes (comma-separated, max 100)</Label>
            <Textarea
              id="bulk-codes"
              placeholder="e.g., 31251, 31252, 31271"
              value={bulkCodes}
              onChange={(e) => setBulkCodes(e.target.value)}
              disabled={bulkMutation.isPending}
              rows={4}
            />
          </div>
          <Button onClick={handleBulkScrape} disabled={bulkMutation.isPending}>
            {bulkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scraping...
              </>
            ) : (
              'Scrape Multiple'
            )}
          </Button>
          {bulkMutation.isPending && (
            <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
              <LoadingSpinner className="h-5 w-5" />
              <p className="text-sm text-blue-800 mt-2">Scraping in progress. This may take a few minutes...</p>
            </div>
          )}
          {bulkMessage && (
            <div
              className={`p-3 rounded-md text-sm ${
                bulkMessage.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {bulkMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Range Scraper */}
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold mb-4">Range Scraper</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-code">Start Code (5 digits)</Label>
              <Input
                id="start-code"
                placeholder="e.g., 31000"
                value={startCode}
                onChange={(e) => setStartCode(e.target.value)}
                disabled={rangeMutation.isPending}
              />
            </div>
            <div>
              <Label htmlFor="end-code">End Code (5 digits)</Label>
              <Input
                id="end-code"
                placeholder="e.g., 32000"
                value={endCode}
                onChange={(e) => setEndCode(e.target.value)}
                disabled={rangeMutation.isPending}
              />
            </div>
          </div>
          <div className="p-3 rounded-md bg-yellow-50 border border-yellow-200">
            <p className="text-sm text-yellow-800">
              Warning: Range scraping may take a long time depending on the range size. The operation will process
              all codes in the specified range.
            </p>
          </div>
          <Button onClick={handleRangeScrape} disabled={rangeMutation.isPending}>
            {rangeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scraping...
              </>
            ) : (
              'Scrape Range'
            )}
          </Button>
          {rangeMutation.isPending && (
            <div className="p-3 rounded-md bg-blue-50 border border-blue-200">
              <LoadingSpinner className="h-5 w-5" />
              <p className="text-sm text-blue-800 mt-2">Range scraping in progress. This may take several minutes...</p>
            </div>
          )}
          {rangeMessage && (
            <div
              className={`p-3 rounded-md text-sm ${
                rangeMessage.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {rangeMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* Recent Scrapes Table */}
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-lg font-semibold mb-4">Recent Scrapes</h3>
        {!recentScrapes ? (
          <LoadingSpinner />
        ) : recentScrapes.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No scrapes yet.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-4 py-3">Subject Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentScrapes.map((scrape) => (
                  <tr key={scrape.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono">{scrape.unitCode}</td>
                    <td className="px-4 py-3">{scrape.unitName}</td>
                    <td className="px-4 py-3">
                      {scrape.scrapedAt ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                          Success
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
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

      {/* Range Scrape Confirmation Dialog */}
      <ConfirmDialog
        open={rangeDialogOpen}
        onOpenChange={setRangeDialogOpen}
        title="Confirm Range Scrape"
        description={
          pendingRange
            ? `Are you sure you want to scrape all codes from ${pendingRange.start} to ${pendingRange.end}? This operation may take a long time and cannot be cancelled.`
            : ''
        }
        confirmText="Start Scraping"
        onConfirm={confirmRangeScrape}
        variant="destructive"
      />
    </div>
  );
}
