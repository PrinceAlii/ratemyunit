import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.js';
import { scraperQueue } from '../lib/queue.js';

const scrapeSchema = z.object({
  unitCode: z.string().min(1),
});

export async function adminRoutes(app: FastifyInstance) {
  // Protect all admin routes
  app.addHook('preHandler', requireAdmin);

  /**
   * POST /api/admin/scrape
   * Trigger a scrape job for a unit.
   */
  app.post('/scrape', async (request, reply) => {
    // Parse body using Zod manually or use a validator
    // Here we use manual parse for simplicity
    const result = scrapeSchema.safeParse(request.body);
    
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: result.error,
      });
    }

    const { unitCode } = result.data;

    // Add to queue
    await scraperQueue.add('scrape-unit', { unitCode });

    return reply.send({
      success: true,
      message: `Scrape job queued for unit ${unitCode}`,
    });
  });
}
