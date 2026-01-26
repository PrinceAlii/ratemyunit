import { BaseScraper, ScraperConfig } from './strategies/base';
import { CourseLoopScraper } from './strategies/courseloop';
import { GenericDomScraper } from './strategies/generic';
// import { AkariScraper } from './strategies/akari'; // Future

export type ScraperType = 'courseloop' | 'akari' | 'custom' | 'legacy';

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
        return new GenericDomScraper(universityName, config);
      case 'akari':
        // Reuse generic for now or implement specific strategy
        return new GenericDomScraper(universityName, config); 
      case 'legacy':
      default:
        // Default to generic which logs error if no selectors
        return new GenericDomScraper(universityName, config);
    }
  }
}
