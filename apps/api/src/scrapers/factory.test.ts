import { describe, it, expect, vi } from 'vitest';

vi.mock('./strategies/courseloop.js', () => ({
  CourseLoopScraper: vi.fn().mockImplementation(function (this: Record<string, unknown>, name: string, config: unknown) {
    this.name = name;
    this.config = config;
    this.type = 'courseloop';
  }),
}));

vi.mock('./strategies/generic.js', () => ({
  GenericDomScraper: vi.fn().mockImplementation(function (this: Record<string, unknown>, name: string, config: unknown) {
    this.name = name;
    this.config = config;
    this.type = 'generic';
  }),
}));

vi.mock('./strategies/search.js', () => ({
  SearchDomScraper: vi.fn().mockImplementation(function (this: Record<string, unknown>, name: string, config: unknown) {
    this.name = name;
    this.config = config;
    this.type = 'search';
  }),
}));

import { ScraperFactory } from './factory';
import { CourseLoopScraper } from './strategies/courseloop.js';
import { GenericDomScraper } from './strategies/generic.js';
import { SearchDomScraper } from './strategies/search.js';

const testConfig = { baseUrl: 'https://example.com', selectors: {} } as never;

describe('ScraperFactory', () => {
  it('creates CourseLoopScraper for courseloop type', () => {
    ScraperFactory.createScraper('courseloop', 'UTS', testConfig);
    expect(CourseLoopScraper).toHaveBeenCalledWith('UTS', testConfig);
  });

  it('creates GenericDomScraper for custom type', () => {
    ScraperFactory.createScraper('custom', 'USYD', testConfig);
    expect(GenericDomScraper).toHaveBeenCalledWith('USYD', testConfig);
  });

  it('creates GenericDomScraper for cusp type', () => {
    ScraperFactory.createScraper('cusp', 'USYD', testConfig);
    expect(GenericDomScraper).toHaveBeenCalledWith('USYD', testConfig);
  });

  it('creates GenericDomScraper for akari type', () => {
    ScraperFactory.createScraper('akari', 'UNSW', testConfig);
    expect(GenericDomScraper).toHaveBeenCalledWith('UNSW', testConfig);
  });

  it('creates SearchDomScraper for search_dom type', () => {
    ScraperFactory.createScraper('search_dom', 'UQ', testConfig);
    expect(SearchDomScraper).toHaveBeenCalledWith('UQ', testConfig);
  });

  it('defaults to GenericDomScraper for legacy type', () => {
    ScraperFactory.createScraper('legacy', 'ANU', testConfig);
    expect(GenericDomScraper).toHaveBeenCalledWith('ANU', testConfig);
  });

  it('passes config to scraper constructor correctly', () => {
    const customConfig = { baseUrl: 'https://custom.com', selectors: { title: 'h1' } } as never;
    ScraperFactory.createScraper('courseloop', 'UTS', customConfig);
    expect(CourseLoopScraper).toHaveBeenCalledWith('UTS', customConfig);
  });
});
