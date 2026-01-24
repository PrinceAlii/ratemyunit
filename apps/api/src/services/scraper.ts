import { chromium } from 'playwright';
import { db } from '@ratemyunit/db/client';
import { units, universities } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';

export class ScraperService {
  private static BASE_URL = 'https://handbook.uts.edu.au/subjects';

  async scrapeUnit(unitCode: string) {
    console.log(`Starting scrape for unit: ${unitCode}`);
    const browser = await chromium.launch({ headless: true });
    
    try {
      const page = await browser.newPage();
      const url = `${ScraperService.BASE_URL}/${unitCode}.html`;
      
      console.log(`Navigating to ${url}...`);
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      if (response?.status() === 404) {
        throw new Error(`Unit ${unitCode} not found (404)`);
      }

      // Check for "Page not found" text content if status is 200 but content is error
      const content = await page.content();
      if (content.includes('Page not found') || content.includes('The page you requested could not be found')) {
        throw new Error(`Unit ${unitCode} not found (Content check)`);
      }

      // --- Extraction Logic ---
      
      // 1. Title: "48024 Applications Programming"
      // Selector: #main-content h1 or just h1
      const title = await page.locator('h1').first().innerText();
      const cleanTitle = title.trim();
      
      // Split "48024 Applications Programming" -> code: 48024, name: Applications Programming
      const parts = cleanTitle.split(' ');
      const extractedCode = parts[0].match(/\d+/) ? parts[0] : unitCode;
      const extractedName = parts.length > 1 ? parts.slice(1).join(' ') : cleanTitle;

      // 2. Credit Points
      // Usually "Credit points: 6 cp" in a div or p
      // We look for text containing "Credit points"
      let creditPoints = 6; // Default
      try {
        const cpElement = page.getByText(/Credit points/i).first();
        if (await cpElement.isVisible()) {
            const cpText = await cpElement.innerText();
            const match = cpText.match(/(\d+)\s*cp/i);
            if (match) {
                creditPoints = parseInt(match[1], 10);
            }
        }
      } catch (e) {
        console.warn('Could not extract credit points, using default 6');
      }

      // 3. Description
      // Usually in the main content after headers.
      // We'll look for a section "Description" or the first significant paragraph.
      let description = 'No description available.';
      try {
        // Try to find "Description" heading (h2/h3) and get next sibling
        const descHeading = page.getByRole('heading', { name: 'Description' });
        if (await descHeading.count() > 0) {
            // Get the text following it. This is tricky in Playwright without specific structure.
            // Simplified: Get the first paragraph inside .content-area or #content
            // Assuming UTS handbook uses standard semantic HTML often
             description = await page.locator('div.IEwrapper p').first().innerText();
        } else {
             // Fallback: Grab the first paragraph that is long enough
             const paragraphs = await page.locator('p').allInnerTexts();
             const likelyDesc = paragraphs.find(p => p.length > 50 && !p.includes('Credit points'));
             if (likelyDesc) description = likelyDesc;
        }
      } catch (e) {
        console.warn('Could not extract description');
      }

      // 4. Faculty
      // Often listed in metadata or breadcrumbs?
      let faculty = 'Unknown Faculty';
      try {
          // Look for "Faculty of..."
          const facultyText = await page.getByText(/Faculty of/i).first().innerText();
          if (facultyText) faculty = facultyText.trim();
      } catch (e) {
          // Ignore
      }

      console.log(`Extracted: ${extractedCode} - ${extractedName} (${creditPoints}cp)`);

      // --- Database Update ---
      
      // Get University ID
      const [uts] = await db.select().from(universities).where(eq(universities.abbreviation, 'UTS')).limit(1);
      
      if (!uts) throw new Error('University UTS not found in database');

      await db.insert(units).values({
        unitCode: extractedCode,
        unitName: extractedName,
        description: description.substring(0, 1000), // Truncate to fit DB if needed
        creditPoints,
        faculty: faculty.substring(0, 255),
        universityId: uts.id,
        scrapedAt: new Date(),
        active: true,
        sessions: JSON.stringify([]), // Placeholder
      }).onConflictDoUpdate({
        target: [units.universityId, units.unitCode],
        set: {
            unitName: extractedName,
            description: description.substring(0, 1000),
            creditPoints,
            faculty: faculty.substring(0, 255),
            scrapedAt: new Date(),
            active: true
        }
      });

      return { success: true, unitCode: extractedCode, unitName: extractedName };

    } catch (error) {
      console.error(`Error scraping ${unitCode}:`, error);
      throw error;
    } finally {
      await browser.close();
    }
  }
}

export const scraperService = new ScraperService();
