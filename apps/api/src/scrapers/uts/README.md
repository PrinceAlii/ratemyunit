# UTS Subject Scraper

Modern, modular scraper for extracting subject data from the UTS CourseLoop-powered handbook.

## Architecture

The scraper is organized into focused modules with clear responsibilities:

### Core Modules

- **`types.ts`**: TypeScript interfaces for scraped data structures
- **`validator.ts`**: Zod schemas for runtime validation
- **`scraper.ts`**: Playwright-based web scraper (extraction logic)
- **`parser.ts`**: Data transformation and normalization
- **`index.ts`**: Main orchestrator (coordinates scraping, parsing, and persistence)

### Research Scripts

- **`research/discover-api.ts`**: API endpoint discovery script
- **`research/test-api.ts`**: API endpoint testing script
- **`test-scraper.ts`**: Integration test for the scraper

## Usage

### Scrape a Single Subject

```typescript
import { scrapeUTSSubject } from './scrapers/uts';

const result = await scrapeUTSSubject('31251');

if (result.success) {
  console.log(`Scraped: ${result.data.name}`);
} else {
  console.error(`Error: ${result.error}`);
}
```

### Scrape Multiple Subjects

```typescript
import { scrapeUTSSubjects } from './scrapers/uts';

const result = await scrapeUTSSubjects(['31251', '48024', '48430'], {
  delayMs: 2000, // 2 second delay between requests
  continueOnError: true, // Keep going if one fails
});

console.log(`Success: ${result.successful}/${result.total}`);
```

### Scrape All Subjects (with Limit)

```typescript
import { scrapeAllUTSSubjects } from './scrapers/uts';

const result = await scrapeAllUTSSubjects({
  startCode: '31000',
  endCode: '31999',
  limit: 100, // Max 100 subjects
  delayMs: 2000,
});
```

## Data Flow

1. **Scraping**: `scraper.ts` navigates to subject page and extracts raw data
2. **Validation**: `validator.ts` validates extracted data against Zod schemas
3. **Parsing**: `parser.ts` transforms data to database format
4. **Persistence**: `index.ts` saves to database with upsert logic

## Features

### Error Handling

- Comprehensive try/catch blocks throughout
- Graceful degradation (missing fields don't crash scraper)
- Detailed error messages with context
- Validation errors are caught and logged

### Rate Limiting

- Configurable delay between requests (default: 2 seconds)
- Prevents overwhelming the target server
- Respectful scraping practices

### Data Validation

- Runtime validation with Zod schemas
- Type-safe data structures
- Prevents invalid data from reaching database

### Database Integration

- Automatic upsert logic (insert or update)
- Preserves data integrity with transactions
- Tracks when subjects were last scraped

## Testing

Run the test script to verify the scraper works:

```bash
npx tsx apps/api/src/scrapers/uts/test-scraper.ts
```

## Notes

### CourseLoop API

The UTS handbook is powered by CourseLoop, which uses server-side rendering
with Next.js. While CourseLoop has a developer API
(developer.courseloop.com), it requires authentication that we don't have
access to. Therefore, this scraper extracts data from the rendered HTML pages.

### Extraction Strategy

The scraper uses Playwright to:

1. Load the subject page
2. Wait for content to render
3. Extract data using CSS selectors and text patterns
4. Handle various page layouts and missing fields

This approach is more resilient than direct HTML parsing because it works with
the fully rendered page, including JavaScript-loaded content.

## Improvements for Future

- Cache previously scraped subjects to avoid redundant requests
- Add parallel scraping with concurrency limits
- Implement incremental updates (only scrape changed subjects)
- Add metrics and monitoring
- Support for other universities beyond UTS
