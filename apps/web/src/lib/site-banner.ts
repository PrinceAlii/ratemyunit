import type { SiteBannerPalette } from '@ratemyunit/types';

interface SiteBannerPalettePreset {
  label: string;
  description: string;
  bannerClassName: string;
  swatchClassName: string;
}

export const siteBannerPalettePresets: Record<SiteBannerPalette, SiteBannerPalettePreset> = {
  primary: {
    label: 'Electric Blue',
    description: 'High contrast blue with white text.',
    bannerClassName: 'bg-primary text-primary-foreground border-foreground',
    swatchClassName: 'bg-primary text-primary-foreground',
  },
  secondary: {
    label: 'Signal Yellow',
    description: 'Bright warning yellow with black text.',
    bannerClassName: 'bg-secondary text-secondary-foreground border-foreground',
    swatchClassName: 'bg-secondary text-secondary-foreground',
  },
  accent: {
    label: 'Alert Red',
    description: 'Bold red for urgent announcements.',
    bannerClassName: 'bg-accent text-accent-foreground border-foreground',
    swatchClassName: 'bg-accent text-accent-foreground',
  },
  success: {
    label: 'Launch Green',
    description: 'Vibrant green for positive updates.',
    bannerClassName: 'bg-green-500 text-white border-foreground',
    swatchClassName: 'bg-green-500 text-white',
  },
  ink: {
    label: 'Mono Ink',
    description: 'Black-and-white brutalist contrast.',
    bannerClassName: 'bg-black text-white border-foreground',
    swatchClassName: 'bg-black text-white',
  },
};
