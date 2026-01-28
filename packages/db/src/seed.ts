import 'dotenv/config';
import { db } from './client.js';
import { universities, users, subjectCodeTemplates } from './schema.js';
import { hash } from '@node-rs/argon2';
import { eq, and } from 'drizzle-orm';

const AUSTRALIAN_UNIVERSITIES = [
  // --- CourseLoop Universities (Verified) ---
  {
    name: 'University of Technology Sydney',
    abbreviation: 'UTS',
    emailDomain: 'student.uts.edu.au',
    websiteUrl: 'https://www.uts.edu.au',
    handbookUrl: 'https://coursehandbook.uts.edu.au',
    scraperType: 'courseloop',
    scraperRoutes: {
      base: 'https://coursehandbook.uts.edu.au',
      subject: '/subject/current/:code',
      discovery: '/sitemap.xml'
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
      subject: '/undergraduate/courses/2025/:code',
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

    const utsTemplates = [
      // Faculty of Engineering and IT - IT (Priority 10)
      {
        name: 'IT Subjects',
        faculty: 'Faculty of Engineering and IT',
        startCode: '31001',
        endCode: '32999',
        description: 'Information Technology subjects covering software development, data science, networking, and cybersecurity',
        priority: 10,
      },
      // Faculty of Engineering and IT - Engineering (Priority 10)
      {
        name: 'Engineering Subjects',
        faculty: 'Faculty of Engineering and IT',
        startCode: '40001',
        endCode: '49999',
        description: 'Engineering subjects covering civil, mechanical, electrical, biomedical, and software engineering',
        priority: 10,
      },
      // Faculty of Business (Priority 9)
      {
        name: 'Business Subjects',
        faculty: 'Faculty of Business',
        startCode: '20000',
        endCode: '28999',
        description: 'Business subjects covering accounting, finance, management, marketing, and economics',
        priority: 9,
      },
      // Faculty of Health - Range 1 (Priority 8)
      {
        name: 'Health Subjects (09XXX)',
        faculty: 'Faculty of Health',
        startCode: '09001',
        endCode: '09999',
        description: 'Health subjects covering nursing, midwifery, and public health',
        priority: 8,
      },
      // Faculty of Health - Range 2 (Priority 8)
      {
        name: 'Health Subjects (90XXX-93XXX)',
        faculty: 'Faculty of Health',
        startCode: '90001',
        endCode: '93999',
        description: 'Health subjects covering medical sciences, pharmacy, physiotherapy, and allied health',
        priority: 8,
      },
      // Faculty of Health - Range 3 (Priority 8)
      {
        name: 'Health Subjects (96XXX)',
        faculty: 'Faculty of Health',
        startCode: '96001',
        endCode: '96999',
        description: 'Health subjects covering sport and exercise science',
        priority: 8,
      },
      // Faculty of Law (Priority 7)
      {
        name: 'Law Subjects',
        faculty: 'Faculty of Law',
        startCode: '70000',
        endCode: '79999',
        description: 'Law subjects covering legal practice, business law, criminal law, and international law',
        priority: 7,
      },
      // Faculty of Communication (Priority 6)
      {
        name: 'Communication Subjects',
        faculty: 'Faculty of Communication',
        startCode: '50000',
        endCode: '59999',
        description: 'Communication subjects covering journalism, media production, public relations, and social inquiry',
        priority: 6,
      },
      // Faculty of Design, Architecture & Building - Range 1 (Priority 5)
      {
        name: 'Design, Architecture & Building (11XXX-17XXX)',
        faculty: 'Faculty of Design, Architecture & Building',
        startCode: '11001',
        endCode: '17999',
        description: 'Subjects covering design, visual communication, product design, and fashion',
        priority: 5,
      },
      // Faculty of Design, Architecture & Building - Range 2 (Priority 5)
      {
        name: 'Design, Architecture & Building (80XXX-89XXX)',
        faculty: 'Faculty of Design, Architecture & Building',
        startCode: '80001',
        endCode: '89999',
        description: 'Subjects covering architecture, built environment, construction management, and property',
        priority: 5,
      },
      // Faculty of Science - Range 1 (Priority 4)
      {
        name: 'Science Subjects (33XXX-37XXX)',
        faculty: 'Faculty of Science',
        startCode: '33001',
        endCode: '37999',
        description: 'Science subjects covering mathematics, statistics, and environmental science',
        priority: 4,
      },
      // Faculty of Science - Range 2 (Priority 4)
      {
        name: 'Science Subjects (60XXX)',
        faculty: 'Faculty of Science',
        startCode: '60001',
        endCode: '60999',
        description: 'Science subjects covering biotechnology and molecular bioscience',
        priority: 4,
      },
      // Faculty of Science - Range 3 (Priority 4)
      {
        name: 'Science Subjects (65XXX-69XXX)',
        faculty: 'Faculty of Science',
        startCode: '65001',
        endCode: '69999',
        description: 'Science subjects covering chemistry, physics, and forensic science',
        priority: 4,
      },
      // Faculty of Education (Priority 3)
      {
        name: 'Education Subjects',
        faculty: 'Faculty of Education',
        startCode: '01001',
        endCode: '02999',
        description: 'Education subjects covering primary, secondary, and adult education, as well as educational leadership',
        priority: 3,
      },
      // Transdisciplinary Innovation (Priority 2)
      {
        name: 'Transdisciplinary Innovation Subjects',
        faculty: 'Transdisciplinary Innovation',
        startCode: '94001',
        endCode: '95999',
        description: 'Transdisciplinary subjects covering innovation, entrepreneurship, and creative intelligence',
        priority: 2,
      },
      // International & Exchange (Priority 1)
      {
        name: 'International & Exchange Subjects',
        faculty: 'International & Exchange',
        startCode: '97001',
        endCode: '99999',
        description: 'Subjects for international students and exchange programs',
        priority: 1,
      },
    ];

    for (const template of utsTemplates) {
      const [existing] = await db
        .select()
        .from(subjectCodeTemplates)
        .where(
          and(
            eq(subjectCodeTemplates.universityId, utsId),
            eq(subjectCodeTemplates.name, template.name)
          )
        );

      if (!existing) {
        await db.insert(subjectCodeTemplates).values({
          universityId: utsId,
          name: template.name,
          templateType: 'range',
          startCode: template.startCode,
          endCode: template.endCode,
          description: template.description,
          faculty: template.faculty,
          priority: template.priority,
          active: true,
          createdBy: adminUser.id,
        });
        console.log(`✓ Created template: ${template.name}`);
      } else {
        console.log(`  Template already exists: ${template.name}`);
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