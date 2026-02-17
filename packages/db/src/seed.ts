import 'dotenv/config';
import { db } from './client.js';
import { universities, users, subjectCodeTemplates } from './schema.js';
import { hash } from '@node-rs/argon2';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFacultyFromName(templateName: string): string {
  if (templateName.includes('IT')) return 'Faculty of Engineering and IT';
  if (templateName.includes('Engineering')) return 'Faculty of Engineering and IT';
  if (templateName.includes('Business')) return 'Faculty of Business';
  if (templateName.includes('Health')) return 'Faculty of Health';
  if (templateName.includes('Law')) return 'Faculty of Law';
  if (templateName.includes('Communication')) return 'Faculty of Communication';
  if (templateName.includes('Design') || templateName.includes('Architecture'))
    return 'Faculty of Design, Architecture & Building';
  if (templateName.includes('Science')) return 'Faculty of Science';
  if (templateName.includes('Education')) return 'Faculty of Education';
  return 'Other';
}

const AUSTRALIAN_UNIVERSITIES = [
  // --- CourseLoop Universities (Verified) ---
  {
    name: 'University of Technology Sydney',
    abbreviation: 'UTS',
    emailDomain: 'student.uts.edu.au',
    websiteUrl: 'https://www.uts.edu.au',
    handbookUrl: 'https://handbook.uts.edu.au',
    scraperType: 'courseloop',
    scraperRoutes: {
      base: 'https://handbook.uts.edu.au',
      subject: '/subject/current/:code',
      discovery: '/subjects/numerical.html'
    }
  },
  {
    name: 'Monash University',
    abbreviation: 'Monash',
    emailDomain: 'student.monash.edu',
    websiteUrl: 'https://www.monash.edu',
    handbookUrl: 'https://handbook.monash.edu',
    scraperType: 'courseloop',
    scraperRoutes: {
      base: 'https://handbook.monash.edu',
      subject: '/current/units/:code',
      discovery: '/sitemap.xml'
    }
  },
  {
    name: 'Flinders University',
    abbreviation: 'Flinders',
    emailDomain: 'flinders.edu.au',
    websiteUrl: 'https://www.flinders.edu.au',
    handbookUrl: 'https://handbook.flinders.edu.au',
    scraperType: 'courseloop',
    scraperRoutes: {
      base: 'https://handbook.flinders.edu.au',
      subject: '/topics/2026/:code',
      discovery: '/sitemap.xml'
    }
  },
  {
    name: 'James Cook University',
    abbreviation: 'JCU',
    emailDomain: 'my.jcu.edu.au',
    websiteUrl: 'https://www.jcu.edu.au',
    handbookUrl: 'https://handbook.jcu.edu.au',
    scraperType: 'courseloop',
    scraperRoutes: {
      base: 'https://handbook.jcu.edu.au',
      subject: '/subject/2025/:code',
      discovery: '/sitemap.xml'
    }
  },
  {
    name: 'Macquarie University',
    abbreviation: 'MQ',
    emailDomain: 'students.mq.edu.au',
    websiteUrl: 'https://www.mq.edu.au',
    handbookUrl: 'https://coursehandbook.mq.edu.au',
    scraperType: 'courseloop',
    scraperRoutes: {
      base: 'https://coursehandbook.mq.edu.au',
      subject: '/2025/units/:code',
      discovery: '/sitemap.xml'
    }
  },

  // --- CourseLeaf / Other (Using Generic Scraper) ---
  {
    name: 'Western Sydney University',
    abbreviation: 'WSU',
    emailDomain: 'student.westernsydney.edu.au',
    websiteUrl: 'https://www.westernsydney.edu.au',
    handbookUrl: 'https://hbook.westernsydney.edu.au',
    scraperType: 'custom',
    scraperRoutes: {
      base: 'https://hbook.westernsydney.edu.au',
      subject: '/subject-details/:code',
      discovery: '/subject-search/api/?page=fose&route=search'
    },
    scraperSelectors: {
      title: 'h1.page-title',
      description: '#textcontainer',
      creditPoints: 'strong:has-text("Credit Points") + text()',
      faculty: 'strong:has-text("School") + text()'
    }
  },
  {
    name: 'Queensland University of Technology',
    abbreviation: 'QUT',
    emailDomain: 'student.qut.edu.au',
    websiteUrl: 'https://www.qut.edu.au',
    handbookUrl: 'https://www.qut.edu.au/study',
    scraperType: 'custom',
    scraperRoutes: { base: 'https://www.qut.edu.au', subject: '/study/unit?unitCode=:code' },
    scraperSelectors: {
      title: 'h1',
      description: '#unit-synopsis'
    }
  },
  
  // --- Akari / Generic Universities ---
  {
    name: 'University of Sydney',
    abbreviation: 'USYD',
    emailDomain: 'uni.sydney.edu.au',
    websiteUrl: 'https://www.sydney.edu.au',
    handbookUrl: 'https://cusp.sydney.edu.au/students/view-units-page/',
    scraperType: 'cusp',
    scraperRoutes: {
      base: 'https://cusp.sydney.edu.au',
      subject: '/students/view-unit-page/alpha/:code',
      discovery: '/students/view-units-page/did//get_table/1/'
    },
    scraperSelectors: {
      title: 'h2',
      description: '.description',
      faculty: '.faculty',
      creditPoints: 'td:contains("Credit points")'
    }
  },

  // --- Search-Based Scrapers (Explicit Config) ---
  {
    name: 'Swinburne University of Technology',
    abbreviation: 'Swinburne',
    emailDomain: 'student.swin.edu.au',
    websiteUrl: 'https://www.swinburne.edu.au',
    handbookUrl: 'https://www.swinburne.edu.au/study/courses',
    scraperType: 'search_dom',
    scraperRoutes: {
      base: 'https://www.swinburne.edu.au',
      search: '/search?q=:code'
    },
    scraperSelectors: {
      title: 'h1',
      description: '.b-summary',
      search: {
        input: 'input[name="q"]',
        result: '.result-item a'
      }
    }
  },
  {
    name: 'RMIT University',
    abbreviation: 'RMIT',
    emailDomain: 'student.rmit.edu.au',
    websiteUrl: 'https://www.rmit.edu.au',
    handbookUrl: 'https://www.rmit.edu.au/students/student-essentials/program-and-course-information',
    scraperType: 'search_dom',
    scraperRoutes: {
      base: 'https://www.rmit.edu.au',
      search: '/search?q=:code'
    },
    scraperSelectors: {
      title: 'h1',
      search: {
        input: 'input[name="q"]',
        result: 'a[href*="/courses/"]'
      }
    }
  },
  {
    name: 'University of Adelaide',
    abbreviation: 'Adelaide',
    emailDomain: 'student.adelaide.edu.au',
    websiteUrl: 'https://www.adelaide.edu.au',
    handbookUrl: 'https://www.adelaide.edu.au/course-outlines',
    scraperType: 'search_dom',
    scraperRoutes: {
      base: 'https://www.adelaide.edu.au',
      search: '/course-outlines/'
    },
    scraperSelectors: {
      title: 'h1',
      search: {
        input: 'input[name="keyword"]',
        btn: 'input[type="submit"]',
        result: '.course-result a'
      }
    }
  },

  // --- Group of Eight & Major (Custom) ---
  {
    name: 'University of New South Wales',
    abbreviation: 'UNSW',
    emailDomain: 'student.unsw.edu.au',
    websiteUrl: 'https://www.unsw.edu.au',
    handbookUrl: 'https://www.handbook.unsw.edu.au',
    scraperType: 'courseloop',
    scraperRoutes: {
      base: 'https://www.handbook.unsw.edu.au',
      subject: '/undergraduate/courses/2026/:code',
      discovery: '/sitemap.xml'
    }
  },
  {
    name: 'University of New South Wales (Postgraduate)',
    abbreviation: 'UNSW-PG',
    emailDomain: 'pgstudent.unsw.edu.au',
    websiteUrl: 'https://www.unsw.edu.au',
    handbookUrl: 'https://www.handbook.unsw.edu.au',
    scraperType: 'courseloop',
    scraperRoutes: {
      base: 'https://www.handbook.unsw.edu.au',
      subject: '/postgraduate/courses/2026/:code',
      discovery: '/sitemap.xml'
    }
  },
  {
    name: 'University of Melbourne',
    abbreviation: 'UniMelb',
    emailDomain: 'student.unimelb.edu.au',
    websiteUrl: 'https://www.unimelb.edu.au',
    handbookUrl: 'https://handbook.unimelb.edu.au',
    scraperType: 'custom',
    scraperRoutes: {
      base: 'https://handbook.unimelb.edu.au',
      subject: '/2025/subjects/:code'
    },
    scraperSelectors: {
      title: 'h1', 
      description: '.course__overview-wrapper p'
    }
  },
  {
    name: 'University of Queensland',
    abbreviation: 'UQ',
    emailDomain: 'student.uq.edu.au',
    websiteUrl: 'https://www.uq.edu.au',
    handbookUrl: 'https://programs-courses.uq.edu.au',
    scraperType: 'custom',
    scraperRoutes: {
      base: 'https://programs-courses.uq.edu.au',
      subject: '/course.html?course_code=:code',
      discovery: '/search.html?searchType=coursecode&keywords=*'
    },
    scraperSelectors: {
      title: '#course-title',
      description: '#course-summary',
      creditPoints: '#course-units'
    }
  },
  {
    name: 'Australian National University',
    abbreviation: 'ANU',
    emailDomain: 'anu.edu.au',
    websiteUrl: 'https://www.anu.edu.au',
    handbookUrl: 'https://programsandcourses.anu.edu.au',
    scraperType: 'custom',
    scraperRoutes: {
      base: 'https://programsandcourses.anu.edu.au',
      subject: '/2025/course/:code'
    },
    scraperSelectors: {
      title: 'h1',
      description: '.introduction p'
    }
  },
  {
    name: 'University of Western Australia',
    abbreviation: 'UWA',
    emailDomain: 'student.uwa.edu.au',
    websiteUrl: 'https://www.uwa.edu.au',
    handbookUrl: 'https://handbooks.uwa.edu.au',
    scraperType: 'custom',
    scraperRoutes: {
      base: 'https://handbooks.uwa.edu.au',
      subject: '/unitdetails?code=:code'
    },
    scraperSelectors: {
      title: 'h1',
      description: 'dt:has-text("Description") + dd',
      creditPoints: 'dt:has-text("Credit") + dd'
    }
  }
];

async function seed() {
  console.log('Seeding database with ALL Australian Universities...');

  try {
    const universityMap = new Map();

    for (const uniData of AUSTRALIAN_UNIVERSITIES) {
      let [existing] = await db
        .select()
        .from(universities)
        .where(eq(universities.emailDomain, uniData.emailDomain));

      if (!existing) {
        [existing] = await db
          .insert(universities)
          .values({
            ...uniData,
            active: true,
            scraperType: uniData.scraperType as any,
          })
          .returning();
        console.log(`✓ Created ${uniData.name}`);
      } else {
        await db
          .update(universities)
          .set({
            scraperType: uniData.scraperType as any,
            scraperRoutes: uniData.scraperRoutes as any,
            scraperSelectors: uniData.scraperSelectors as any,
          })
          .where(eq(universities.id, existing.id));
        console.log(`✓ Updated ${uniData.name}`);
      }
      
      universityMap.set(uniData.abbreviation, existing.id);
    }

    const utsId = universityMap.get('UTS');
    if (!utsId) throw new Error('UTS ID not found after seeding');

    const passwordHash = await hash('password123', {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const [existingAdmin] = await db.select().from(users).where(eq(users.email, 'admin@uts.edu.au'));
    let adminUser;
    if (!existingAdmin) {
      [adminUser] = await db.insert(users).values({
        email: 'admin@uts.edu.au',
        passwordHash,
        displayName: 'Admin',
        role: 'admin',
        universityId: utsId,
        emailVerified: true,
        banned: false,
      }).returning();
      console.log('✓ Created Admin User');
    } else {
      adminUser = existingAdmin;
    }

    // Seed UTS Subject Code Templates
    console.log('\nSeeding UTS Subject Code Templates...');

    // Read valid codes from file
    const codesPath = path.resolve(__dirname, './data/uts_codes.txt');
    let validCodes: string[] = [];

    try {
      const content = fs.readFileSync(codesPath, 'utf-8');
      validCodes = content.split('\n').map(c => c.trim()).filter(c => c.length > 0);
      console.log(`✓ Loaded ${validCodes.length} valid UTS codes`);
    } catch (error) {
      console.error('❌ Failed to read uts_codes.txt:', error);
      throw error;
    }

    // Group codes by faculty prefix
    const groups: Record<string, string[]> = {
      'IT Subjects (31XXX-32XXX)': [],
      'Engineering Subjects (4XXXX)': [],
      'Business Subjects (2XXXX)': [],
      'Health Subjects (9XXXX, 09XXX)': [],
      'Law Subjects (7XXXX)': [],
      'Communication Subjects (5XXXX)': [],
      'Design/Architecture (1XXXX, 8XXXX)': [],
      'Science Subjects (33XXX-37XXX, 6XXXX)': [],
      'Education Subjects (01XXX-02XXX)': [],
    };

    const miscCodes: string[] = [];

    for (const code of validCodes) {
      if (code.startsWith('31') || code.startsWith('32')) {
        groups['IT Subjects (31XXX-32XXX)'].push(code);
      } else if (code.startsWith('4')) {
        groups['Engineering Subjects (4XXXX)'].push(code);
      } else if (code.startsWith('2')) {
        groups['Business Subjects (2XXXX)'].push(code);
      } else if (code.startsWith('09') || code.startsWith('90') || code.startsWith('91') ||
                 code.startsWith('92') || code.startsWith('93') || code.startsWith('96')) {
        groups['Health Subjects (9XXXX, 09XXX)'].push(code);
      } else if (code.startsWith('7')) {
        groups['Law Subjects (7XXXX)'].push(code);
      } else if (code.startsWith('5')) {
        groups['Communication Subjects (5XXXX)'].push(code);
      } else if (code.startsWith('1') || code.startsWith('8')) {
        groups['Design/Architecture (1XXXX, 8XXXX)'].push(code);
      } else if (code.startsWith('33') || code.startsWith('34') || code.startsWith('35') ||
                 code.startsWith('36') || code.startsWith('37') || code.startsWith('6')) {
        groups['Science Subjects (33XXX-37XXX, 6XXXX)'].push(code);
      } else if (code.startsWith('01') || code.startsWith('02')) {
        groups['Education Subjects (01XXX-02XXX)'].push(code);
      } else {
        miscCodes.push(code);
      }
    }

    if (miscCodes.length > 0) {
      groups['Other Subjects'] = miscCodes;
    }

    // Create list templates instead of range templates
    let priority = 10;
    for (const [name, codes] of Object.entries(groups)) {
      if (codes.length === 0) continue;

      const [existing] = await db
        .select()
        .from(subjectCodeTemplates)
        .where(
          and(
            eq(subjectCodeTemplates.universityId, utsId),
            eq(subjectCodeTemplates.name, `${name} (List)`)
          )
        );

      if (!existing) {
        await db.insert(subjectCodeTemplates).values({
          universityId: utsId,
          name: `${name} (List)`,
          templateType: 'list',
          codeList: codes,
          description: `Exact list of ${codes.length} valid subjects from official list`,
          faculty: getFacultyFromName(name),
          priority: priority--,
          active: true,
          createdBy: adminUser.id,
        });
        console.log(`✓ Created template: ${name} (List) - ${codes.length} codes`);
      } else {
        console.log(`  Template already exists: ${name} (List)`);
      }
    }

    console.log('\n✅ Database seeded with Australian Universities and UTS Templates!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });