import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SiteBannerSettings } from '@ratemyunit/types';
import { api } from '../../lib/api';
import { siteBannerPalettePresets } from '../../lib/site-banner';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';

const DEFAULT_SETTINGS: SiteBannerSettings = {
  enabled: false,
  enforceEduAuEmail: false,
  message: '',
  palette: 'primary',
};


export function SiteBannerSettingsPanel() {
  const queryClient = useQueryClient();
  const [draftSettings, setDraftSettings] = useState<SiteBannerSettings | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'site-banner'],
    queryFn: () => api.get<SiteBannerSettings>('/api/admin/site-banner'),
  });

  const currentSettings = draftSettings ?? settings ?? DEFAULT_SETTINGS;

  const updateCurrentSettings = (changes: Partial<SiteBannerSettings>) => {
    setDraftSettings({
      ...currentSettings,
      ...changes,
    });
  };

  const saveMutation = useMutation({
    mutationFn: (payload: SiteBannerSettings) =>
      api.put<SiteBannerSettings>('/api/admin/site-banner', payload),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(['admin', 'site-banner'], updatedSettings);
      queryClient.invalidateQueries({ queryKey: ['public', 'site-banner'] });
      setDraftSettings(updatedSettings);
      toast.success(updatedSettings.enabled ? 'Site banner enabled.' : 'Site banner disabled.');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save banner settings: ${error.message}`);
    },
  });

  const handleSave = () => {
    const message = currentSettings.message.trim();

    if (currentSettings.enabled && message.length === 0) {
      toast.error('Banner message is required when enabled.');
      return;
    }

    saveMutation.mutate({
      ...currentSettings,
      message,
    });
  };

  if (isLoading && !settings && !draftSettings) {
    return <div className="p-8 text-center font-bold">Loading banner settings...</div>;
  }

  const selectedPreset = siteBannerPalettePresets[currentSettings.palette];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-8 w-8 text-primary" />
        <h2 className="text-3xl font-display font-black uppercase">Site Banner</h2>
      </div>

      <div className="p-6 border-4 border-foreground bg-card shadow-neo space-y-6">
        <div className="flex items-center gap-3">
          <input
            id="site-banner-enabled"
            type="checkbox"
            checked={currentSettings.enabled}
            onChange={(e) => updateCurrentSettings({ enabled: e.target.checked })}
            className="h-5 w-5 border-3 border-foreground"
          />
          <Label htmlFor="site-banner-enabled" className="font-bold uppercase text-sm cursor-pointer">
            Enable site-wide banner
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="registration-edu-enforced"
            type="checkbox"
            checked={currentSettings.enforceEduAuEmail}
            onChange={(e) => updateCurrentSettings({ enforceEduAuEmail: e.target.checked })}
            className="h-5 w-5 border-3 border-foreground"
          />
          <Label htmlFor="registration-edu-enforced" className="font-bold uppercase text-sm cursor-pointer">
            Require .edu.au emails for signup
          </Label>
        </div>
        <p className="text-xs font-medium text-muted-foreground -mt-4">
          Disable this to allow any valid email address during registration.
        </p>

        <div className="space-y-2">
          <Label htmlFor="site-banner-message" className="font-bold uppercase text-sm">
            Banner message
          </Label>
          <Textarea
            id="site-banner-message"
            value={currentSettings.message}
            onChange={(e) => updateCurrentSettings({ message: e.target.value })}
            placeholder="e.g. Scheduled maintenance on Sunday from 2:00am to 3:00am."
            rows={3}
            maxLength={280}
            className="border-3"
          />
          <p className="text-xs font-medium text-muted-foreground">
            {currentSettings.message.length}/280 characters
          </p>
        </div>

        <div className="space-y-3">
          <Label className="font-bold uppercase text-sm">Colour preset</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(siteBannerPalettePresets).map(([paletteKey, preset]) => {
              const selected = currentSettings.palette === paletteKey;

              return (
                <button
                  key={paletteKey}
                  type="button"
                  onClick={() => updateCurrentSettings({
                    palette: paletteKey as SiteBannerSettings['palette'],
                  })}
                  className={`p-3 border-4 text-left shadow-neo-sm transition-all ${
                    selected
                      ? 'border-foreground bg-muted'
                      : 'border-foreground/40 bg-background hover:border-foreground'
                  }`}
                >
                  <div className={`border-3 border-black px-3 py-2 font-black uppercase text-sm ${preset.swatchClassName}`}>
                    {preset.label}
                  </div>
                  <p className="mt-2 text-xs font-medium">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-bold uppercase text-sm">Preview</Label>
          <div className={`border-4 border-black px-4 py-3 shadow-neo ${selectedPreset.bannerClassName}`}>
            <p className="font-bold">
              {currentSettings.message.trim() || 'Your banner message preview appears here.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="h-12 border-4 font-bold"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Banner Settings'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
