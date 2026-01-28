import { BaseScraper, ScraperConfig } from './strategies/base';
import { CourseLoopScraper } from './strategies/courseloop';
import { GenericDomScraper } from './strategies/generic';
import { SearchDomScraper } from './strategies/search';

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