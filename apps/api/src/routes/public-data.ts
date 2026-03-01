import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { universities, units, siteBannerSettings } from '@ratemyunit/db/schema';
import { and, eq, asc, isNotNull } from 'drizzle-orm';

const SITE_BANNER_PALETTE_VALUES = ['primary', 'secondary', 'accent', 'success', 'ink'] as const;
type SiteBannerPalette = (typeof SITE_BANNER_PALETTE_VALUES)[number];

interface SiteBannerSettingsResponse {
  enabled: boolean;
  enforceEduAuEmail: boolean;
  message: string;
  palette: SiteBannerPalette;
}

const SITE_BANNER_ROW_ID = 1;
const DEFAULT_SITE_BANNER_SETTINGS: SiteBannerSettingsResponse = {
  enabled: false,
  enforceEduAuEmail: false,
  message: '',
  palette: 'primary',
};

const normalizeSiteBannerSettings = (
  row?: {
    enabled: boolean;
    enforceEduAuEmail: boolean;
    message: string;
    palette: string;
  }
): SiteBannerSettingsResponse => {
  const palette = row?.palette;
  const isValidPalette = SITE_BANNER_PALETTE_VALUES.includes(
    palette as SiteBannerPalette
  );

  return {
    enabled: row?.enabled ?? DEFAULT_SITE_BANNER_SETTINGS.enabled,
    enforceEduAuEmail:
      row?.enforceEduAuEmail ?? DEFAULT_SITE_BANNER_SETTINGS.enforceEduAuEmail,
    message: row?.message ?? DEFAULT_SITE_BANNER_SETTINGS.message,
    palette: isValidPalette
      ? (palette as SiteBannerPalette)
      : DEFAULT_SITE_BANNER_SETTINGS.palette,
  };
};

export async function publicDataRoutes(app: FastifyInstance) {
  /**
   * GET /api/public/universities
   * Get list of active universities for filtering.
   * Publicly accessible, cached for 1 hour ideally (client-side).
   */
  app.get('/universities', async (_request, reply) => {
    const activeUniRows = await db
      .select({
        id: universities.id,
        name: universities.name,
        abbreviation: universities.abbreviation,
        websiteUrl: universities.websiteUrl,
        createdAt: universities.createdAt,
      })
      .from(universities)
      .where(eq(universities.active, true))
      .orderBy(asc(universities.name), asc(universities.createdAt), asc(universities.id));

    const uniqueByAbbreviation = new Map<
      string,
      { id: string; name: string; abbreviation: string; websiteUrl: string | null }
    >();

    for (const uni of activeUniRows) {
      const key = uni.abbreviation.trim().toUpperCase();
      if (!uniqueByAbbreviation.has(key)) {
        uniqueByAbbreviation.set(key, {
          id: uni.id,
          name: uni.name,
          abbreviation: uni.abbreviation,
          websiteUrl: uni.websiteUrl,
        });
      }
    }

    const activeUnis = Array.from(uniqueByAbbreviation.values());

    return reply.send({
      success: true,
      data: activeUnis,
    });
  });

  /**
   * GET /api/public/site-banner
   * Get current site-wide banner settings.
   */
  app.get('/site-banner', async (_request, reply) => {
    const [bannerSettings] = await db
      .select({
        enabled: siteBannerSettings.enabled,
        enforceEduAuEmail: siteBannerSettings.enforceEduAuEmail,
        message: siteBannerSettings.message,
        palette: siteBannerSettings.palette,
      })
      .from(siteBannerSettings)
      .where(eq(siteBannerSettings.id, SITE_BANNER_ROW_ID))
      .limit(1);

    return reply.send({
      success: true,
      data: normalizeSiteBannerSettings(bannerSettings),
    });
  });

  /**
   * GET /api/public/faculties
   * Get distinct faculties, optionally filtered by university.
   * Used by the Browse page filter to show relevant faculty options.
   */
  app.get('/faculties', async (request, reply) => {
    const querySchema = z.object({
      universityId: z.string().uuid().optional(),
    });

    const { universityId } = querySchema.parse(request.query);

    const whereClause = universityId
      ? and(isNotNull(units.faculty), eq(units.universityId, universityId))
      : isNotNull(units.faculty);

    const rows = await db
      .selectDistinct({ faculty: units.faculty })
      .from(units)
      .where(whereClause)
      .orderBy(asc(units.faculty));
    const faculties = rows.map((r) => r.faculty).filter(Boolean) as string[];

    return reply.send({
      success: true,
      data: faculties,
    });
  });
}
