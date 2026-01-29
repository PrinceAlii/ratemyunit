import { BaseScraper, ScraperConfig } from './strategies/base.js';
import { CourseLoopScraper } from './strategies/courseloop.js';
import { GenericDomScraper } from './strategies/generic.js';
import { SearchDomScraper } from './strategies/search.js';

export type ScraperType = 'courseloop' | 'akari' | 'custom' | 'cusp' | 'legacy' | 'search_dom';

export class ScraperFactory {
  static createScraper(
    type: ScraperType,
    universityName: string,
    config: ScraperConfig
  ): BaseScraper {
    switch (type) {
      case 'courseloop':
        return new CourseLoopScraper(universityName, config);
      case 'custom':
      case 'cusp': // CUSP portal (Sydney Uni)
      case 'akari': // Akari maps to Generic for now
        return new GenericDomScraper(universityName, config);
      case 'search_dom':
        return new SearchDomScraper(universityName, config);
      case 'legacy':
      default:
        // Default to generic which logs error if no selectors
        return new GenericDomScraper(universityName, config);
    }
  }
}