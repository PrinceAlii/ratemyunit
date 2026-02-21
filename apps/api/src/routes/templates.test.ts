import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockRequest, createMockReply } from '../__tests__/helpers/auth-mock';
import {
  createMockQueryBuilder,
  createMockInsertBuilder,
  createMockUpdateBuilder,
} from '../__tests__/helpers/db-mock';
import { TEST_IDS, mockAdmin } from '../__tests__/helpers/fixtures';

// --- Mocks ------------------------------------------------------------------

const {
  mockSelect, mockInsert, mockUpdate,
  mockValidateTemplate, mockGenerateCodesFromTemplateData,
  mockAddBulk, mockGetJobCounts,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockValidateTemplate: vi.fn(),
  mockGenerateCodesFromTemplateData: vi.fn(),
  mockAddBulk: vi.fn(),
  mockGetJobCounts: vi.fn(),
}));

vi.mock('@ratemyunit/db/client', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

vi.mock('@ratemyunit/db/schema', () => ({
  subjectCodeTemplates: {
    id: 'id',
    name: 'name',
    templateType: 'templateType',
    startCode: 'startCode',
    endCode: 'endCode',
    codeList: 'codeList',
    pattern: 'pattern',
    description: 'description',
    faculty: 'faculty',
    priority: 'priority',
    active: 'active',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    universityId: 'universityId',
    createdBy: 'createdBy',
  },
  universities: {
    id: 'id',
    name: 'name',
    abbreviation: 'abbreviation',
  },
  units: {
    unitCode: 'unitCode',
    universityId: 'universityId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  desc: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('../services/template.js', () => ({
  subjectTemplateService: {
    validateTemplate: mockValidateTemplate,
    generateCodesFromTemplateData: mockGenerateCodesFromTemplateData,
  },
}));

vi.mock('../lib/queue.js', () => ({
  scraperQueue: {
    addBulk: mockAddBulk,
    getJobCounts: mockGetJobCounts,
  },
}));

import { templateRoutes } from './templates';

// --- Chain builder helper ---------------------------------------------------

function createChainBuilder(resolveValue: unknown = []) {
  const b: Record<string, unknown> = {};
  for (const m of [
    'from',
    'where',
    'limit',
    'offset',
    'orderBy',
    'leftJoin',
    'innerJoin',
    'groupBy',
    'set',
  ]) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  b.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    Promise.resolve(resolveValue).then(resolve),
  );
  return b;
}

// --- Handler capture --------------------------------------------------------

type Handler = (req: unknown, reply: unknown) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

function captureApp() {
  return {
    get: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`GET ${path}`] = args[args.length - 1] as Handler;
    }),
    post: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`POST ${path}`] = args[args.length - 1] as Handler;
    }),
    patch: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`PATCH ${path}`] = args[args.length - 1] as Handler;
    }),
    delete: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`DELETE ${path}`] = args[args.length - 1] as Handler;
    }),
    addHook: vi.fn(),
  } as unknown as FastifyInstance;
}

// --- Mock data --------------------------------------------------------------

const mockTemplate = {
  id: TEST_IDS.template,
  name: 'UTS FEIT List',
  templateType: 'list' as const,
  startCode: null,
  endCode: null,
  codeList: ['31001', '31002'],
  pattern: null,
  description: 'UTS FEIT subject codes',
  faculty: 'FEIT',
  priority: 1,
  active: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  universityId: TEST_IDS.university,
  createdBy: TEST_IDS.admin,
};

const mockTemplateWithUniversity = {
  ...mockTemplate,
  universityName: 'University of Technology Sydney',
  universityAbbreviation: 'UTS',
};

// --- Tests ------------------------------------------------------------------

describe('templateRoutes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
    await templateRoutes(captureApp());
  });

  // ---- GET / (list templates) ---------------------------------------------

  describe('GET / (list templates)', () => {
    it('lists all templates', async () => {
      mockSelect.mockReturnValueOnce(
        createChainBuilder([mockTemplateWithUniversity]),
      );

      const request = createMockRequest({ user: mockAdmin, query: {} });
      const reply = createMockReply();
      const result = await handlers['GET /'](request, reply);

      expect(result).toEqual({
        success: true,
        data: [mockTemplateWithUniversity],
      });
    });

    it('filters by universityId', async () => {
      mockSelect.mockReturnValueOnce(
        createChainBuilder([mockTemplateWithUniversity]),
      );

      const request = createMockRequest({
        user: mockAdmin,
        query: { universityId: TEST_IDS.university },
      });
      const reply = createMockReply();
      const result = await handlers['GET /'](request, reply);

      expect(result).toEqual({
        success: true,
        data: [mockTemplateWithUniversity],
      });
    });

    it('returns empty list when no templates exist', async () => {
      mockSelect.mockReturnValueOnce(createChainBuilder([]));

      const request = createMockRequest({ user: mockAdmin, query: {} });
      const reply = createMockReply();
      const result = await handlers['GET /'](request, reply);

      expect(result).toEqual({ success: true, data: [] });
    });
  });

  // ---- GET /:id (get template) --------------------------------------------

  describe('GET /:id (get template)', () => {
    it('returns a template by ID', async () => {
      mockSelect.mockReturnValueOnce(
        createChainBuilder([mockTemplateWithUniversity]),
      );

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
      });
      const reply = createMockReply();
      const result = await handlers['GET /:id'](request, reply);

      expect(result).toEqual({
        success: true,
        data: mockTemplateWithUniversity,
      });
    });

    it('returns 404 when template not found', async () => {
      mockSelect.mockReturnValueOnce(createChainBuilder([]));

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
      });
      const reply = createMockReply();
      await handlers['GET /:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Template not found' }),
      );
    });
  });

  // ---- POST / (create template) -------------------------------------------

  describe('POST / (create template)', () => {
    const validBody = {
      templateType: 'list',
      universityId: TEST_IDS.university,
      name: 'UTS FEIT List',
      codeList: ['31001', '31002'],
      description: 'UTS FEIT subject codes',
      faculty: 'FEIT',
      priority: 1,
      active: true,
    };

    it('creates a list template', async () => {
      // db.select().from(universities).where().limit(1) -> university found
      mockSelect.mockReturnValueOnce(
        createMockQueryBuilder([{ id: TEST_IDS.university, name: 'UTS' }]),
      );
      // validateTemplate -> valid
      mockValidateTemplate.mockReturnValue({ valid: true, errors: [] });
      // db.insert().values().returning() -> new template
      mockInsert.mockReturnValue(createMockInsertBuilder([mockTemplate]));

      const request = createMockRequest({
        user: mockAdmin,
        body: validBody,
      });
      const reply = createMockReply();
      await handlers['POST /'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Template created successfully',
          data: mockTemplate,
        }),
      );
    });

    it('returns 404 when university not found', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        user: mockAdmin,
        body: validBody,
      });
      const reply = createMockReply();
      await handlers['POST /'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'University not found',
        }),
      );
    });

    it('returns 400 when validation fails', async () => {
      mockSelect.mockReturnValueOnce(
        createMockQueryBuilder([{ id: TEST_IDS.university, name: 'UTS' }]),
      );
      mockValidateTemplate.mockReturnValue({
        valid: false,
        errors: ['Code list is required'],
      });

      const request = createMockRequest({
        user: mockAdmin,
        body: validBody,
      });
      const reply = createMockReply();
      await handlers['POST /'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Template validation failed',
          details: ['Code list is required'],
        }),
      );
    });

    it('returns 400 for invalid body', async () => {
      const request = createMockRequest({
        user: mockAdmin,
        body: { templateType: 'range' },
      });
      const reply = createMockReply();
      await handlers['POST /'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid request body',
        }),
      );
    });
  });

  // ---- PATCH /:id (update template) ---------------------------------------

  describe('PATCH /:id (update template)', () => {
    it('updates a template', async () => {
      const updatedTemplate = { ...mockTemplate, name: 'Updated Name' };
      // db.select().from(subjectCodeTemplates).where().limit(1) -> existing
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockTemplate]));
      // db.update().set().where().returning() -> updated
      mockUpdate.mockReturnValue(createMockUpdateBuilder([updatedTemplate]));

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
        body: { name: 'Updated Name' },
      });
      const reply = createMockReply();
      const result = await handlers['PATCH /:id'](request, reply);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Template updated successfully',
          data: updatedTemplate,
        }),
      );
    });

    it('returns 404 when template not found', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
        body: { name: 'Updated Name' },
      });
      const reply = createMockReply();
      await handlers['PATCH /:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Template not found',
        }),
      );
    });

    it('returns 400 when validation fails on structural field change', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockTemplate]));
      mockValidateTemplate.mockReturnValue({
        valid: false,
        errors: ['List exceeds maximum of 10000 codes'],
      });

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
        body: { codeList: ['31001'] },
      });
      const reply = createMockReply();
      await handlers['PATCH /:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Template validation failed',
          details: ['List exceeds maximum of 10000 codes'],
        }),
      );
    });
  });

  // ---- DELETE /:id (soft delete) ------------------------------------------

  describe('DELETE /:id (soft delete)', () => {
    it('soft-deletes a template', async () => {
      // db.select().from().where().limit(1) -> existing
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockTemplate]));
      // db.update().set().where() -> void
      mockUpdate.mockReturnValue(createMockUpdateBuilder());

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
      });
      const reply = createMockReply();
      const result = await handlers['DELETE /:id'](request, reply);

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Template deleted successfully',
        }),
      );
    });

    it('returns 404 when template not found', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
      });
      const reply = createMockReply();
      await handlers['DELETE /:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Template not found',
        }),
      );
    });
  });

  // ---- POST /:id/preview -------------------------------------------------

  describe('POST /:id/preview', () => {
    it('returns preview codes', async () => {
      const generatedCodes = ['31001', '31002', '31003', '31004', '31005'];
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockTemplate]));
      mockGenerateCodesFromTemplateData.mockReturnValue(generatedCodes);

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
        query: {},
      });
      const reply = createMockReply();
      const result = await handlers['POST /:id/preview'](request, reply);

      expect(mockGenerateCodesFromTemplateData).toHaveBeenCalledWith({
        id: mockTemplate.id,
        templateType: mockTemplate.templateType,
        startCode: mockTemplate.startCode,
        endCode: mockTemplate.endCode,
        codeList: mockTemplate.codeList,
        pattern: mockTemplate.pattern,
      });
      expect(result).toEqual({
        success: true,
        data: {
          codes: generatedCodes,
          total: 5,
          truncated: false,
        },
      });
    });
  });

  // ---- POST /:id/queue ---------------------------------------------------

  describe('POST /:id/queue', () => {
    it('queues scraping jobs', async () => {
      const generatedCodes = ['31001', '31002', '31003'];
      mockSelect
        .mockReturnValueOnce(createMockQueryBuilder([mockTemplate]))
        .mockReturnValueOnce(createMockQueryBuilder([]));
      mockGenerateCodesFromTemplateData.mockReturnValue(generatedCodes);
      mockGetJobCounts.mockResolvedValue({ waiting: 0, active: 0 });
      mockAddBulk.mockResolvedValue(undefined);

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
        body: {},
      });
      const reply = createMockReply();
      const result = await handlers['POST /:id/queue'](request, reply);

      expect(mockAddBulk).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          message: 'Queued 3 scraping jobs',
          data: expect.objectContaining({
            jobsQueued: 3,
            totalCodes: 3,
          }),
        }),
      );
    });

    it('rejects inactive template', async () => {
      const inactiveTemplate = { ...mockTemplate, active: false };
      mockSelect.mockReturnValueOnce(
        createMockQueryBuilder([inactiveTemplate]),
      );

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.template },
        body: {},
      });
      const reply = createMockReply();
      await handlers['POST /:id/queue'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Cannot queue jobs for inactive template',
        }),
      );
    });
  });
});
