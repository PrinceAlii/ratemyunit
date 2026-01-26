import 'dotenv/config';
import { db } from './client.js';
import { universities, users } from './schema.js';
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';

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
      subject: '/subject/current/:code'
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
      subject: '/current/units/:code'
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
      subject: '/topic/:code'
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
      subject: '/subject/:code'
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
      subject: '/subject/:code'
    },
    scraperSelectors: {
      title: 'h1',
      description: '#coursebody'
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
    handbookUrl: 'https://www.sydney.edu.au/handbooks',
    scraperType: 'akari',
    scraperRoutes: {
      base: 'https://www.sydney.edu.au',
      subject: '/units/:code'
    },
    scraperSelectors: {
      title: 'h1.pageTitle',
      description: '.b-summary',
      faculty: 'h4:has-text("Managing faculty") + h4',
      creditPoints: 'th:has-text("Credit points") + td'
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
    scraperType: 'custom',
    scraperRoutes: {
      base: 'https://www.handbook.unsw.edu.au',
      subject: '/undergraduate/courses/2025/:code' 
    },
    scraperSelectors: {
      title: 'h1', 
      description: '[data-testid="readmore-content-Overview"]'
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
    handbookUrl: 'https://my.uq.edu.au/programs-courses',
    scraperType: 'custom',
    scraperRoutes: {
      base: 'https://my.uq.edu.au',
      subject: '/programs-courses/course.html?course_code=:code'
    },
    scraperSelectors: {
      title: 'h1',
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
  },
  {
    name: 'Macquarie University',
    abbreviation: 'MQ',
    emailDomain: 'students.mq.edu.au',
    websiteUrl: 'https://www.mq.edu.au',
    handbookUrl: 'https://coursehandbook.mq.edu.au',
    scraperType: 'custom',
    scraperRoutes: {
      base: 'https://coursehandbook.mq.edu.au',
      subject: '/2025/units/:code'
    },
    scraperSelectors: {
      title: 'h1',
      description: '.description'
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
    if (!existingAdmin) {
      await db.insert(users).values({
        email: 'admin@uts.edu.au',
        passwordHash,
        displayName: 'Admin',
        role: 'admin',
        universityId: utsId,
        emailVerified: true,
        banned: false,
      });
      console.log('✓ Created Admin User');
    }
    
    console.log('\n✅ Database seeded with Australian Universities!');
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