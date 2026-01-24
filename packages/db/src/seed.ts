import 'dotenv/config';
import { db } from './client.js';
import { universities, users, units, reviews } from './schema.js';
import { hash } from '@node-rs/argon2';

async function seed() {
  console.log('Seeding database...');

  try {
    // Create UTS university
    const [uts] = await db
      .insert(universities)
      .values({
        name: 'University of Technology Sydney',
        abbreviation: 'UTS',
        emailDomain: 'student.uts.edu.au',
        websiteUrl: 'https://www.uts.edu.au',
        handbookUrl: 'https://handbook.uts.edu.au',
        active: true,
      })
      .returning();

    console.log('✓ Created UTS university');

    // Create admin user
    const passwordHash = await hash('password123', {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const [_adminUser] = await db
      .insert(users)
      .values({
        email: 'admin@uts.edu.au',
        passwordHash,
        displayName: 'Admin',
        role: 'admin',
        universityId: uts.id,
        emailVerified: true,
        banned: false,
      })
      .returning();

    console.log('✓ Created admin user (admin@uts.edu.au / password123)');

    // Create test student users
    const [student1] = await db
      .insert(users)
      .values({
        email: 'student1@student.uts.edu.au',
        passwordHash,
        displayName: 'Test Student 1',
        role: 'student',
        universityId: uts.id,
        emailVerified: true,
        banned: false,
      })
      .returning();

    const [student2] = await db
      .insert(users)
      .values({
        email: 'student2@student.uts.edu.au',
        passwordHash,
        displayName: 'Test Student 2',
        role: 'student',
        universityId: uts.id,
        emailVerified: true,
        banned: false,
      })
      .returning();

    console.log('✓ Created test student users');

    // Create sample units
    const sampleUnits = [
      {
        unitCode: '48024',
        unitName: 'Applications Programming',
        description:
          'This subject introduces students to programming as a fundamental skill for software development. Students learn to design, code, debug and test programs.',
        creditPoints: 6,
        prerequisites: 'None',
        antiRequisites: 'None',
        sessions: JSON.stringify([
          { year: 2024, session: 'Autumn', mode: 'On-campus' },
          { year: 2024, session: 'Spring', mode: 'On-campus' },
        ]),
        faculty: 'Faculty of Engineering and IT',
      },
      {
        unitCode: '31251',
        unitName: 'Data Structures and Algorithms',
        description:
          'This subject covers fundamental data structures and algorithms essential for software development.',
        creditPoints: 6,
        prerequisites: '48024 Applications Programming',
        antiRequisites: 'None',
        sessions: JSON.stringify([
          { year: 2024, session: 'Autumn', mode: 'On-campus' },
          { year: 2024, session: 'Spring', mode: 'On-campus' },
        ]),
        faculty: 'Faculty of Engineering and IT',
      },
      {
        unitCode: '32555',
        unitName: 'Web Systems',
        description:
          'This subject introduces modern web application development including frontend and backend technologies.',
        creditPoints: 6,
        prerequisites: '48024 Applications Programming',
        antiRequisites: 'None',
        sessions: JSON.stringify([
          { year: 2024, session: 'Autumn', mode: 'On-campus' },
          { year: 2024, session: 'Spring', mode: 'Online' },
        ]),
        faculty: 'Faculty of Engineering and IT',
      },
      {
        unitCode: '41025',
        unitName: 'Introduction to Software Development',
        description:
          'An introduction to software development practices, version control, and collaborative programming.',
        creditPoints: 6,
        prerequisites: 'None',
        antiRequisites: 'None',
        sessions: JSON.stringify([{ year: 2024, session: 'Autumn', mode: 'On-campus' }]),
        faculty: 'Faculty of Engineering and IT',
      },
      {
        unitCode: '31005',
        unitName: 'Machine Learning',
        description:
          'Introduction to machine learning concepts, algorithms, and applications.',
        creditPoints: 6,
        prerequisites: '31251 Data Structures and Algorithms',
        antiRequisites: 'None',
        sessions: JSON.stringify([{ year: 2024, session: 'Spring', mode: 'On-campus' }]),
        faculty: 'Faculty of Engineering and IT',
      },
    ];

    const createdUnits = await db
      .insert(units)
      .values(
        sampleUnits.map((unit) => ({
          ...unit,
          universityId: uts.id,
          scrapedAt: new Date(),
          active: true,
        }))
      )
      .returning();

    console.log(`✓ Created ${createdUnits.length} sample units`);

    // Create sample reviews
    const sampleReviews = [
      {
        unitId: createdUnits[0].id, // Applications Programming
        userId: student1.id,
        sessionTaken: 'Autumn 2024',
        displayNameType: 'verified' as const,
        customNickname: null,
        overallRating: 5,
        teachingQualityRating: 5,
        workloadRating: 3,
        difficultyRating: 2,
        usefulnessRating: 5,
        reviewText:
          'Excellent introduction to programming! The lecturer was very clear and the assignments were well-structured. Highly recommend for beginners.',
        wouldRecommend: true,
        status: 'auto-approved' as const,
      },
      {
        unitId: createdUnits[0].id, // Applications Programming
        userId: student2.id,
        sessionTaken: 'Spring 2023',
        displayNameType: 'nickname' as const,
        customNickname: 'CodeNewbie',
        overallRating: 4,
        teachingQualityRating: 4,
        workloadRating: 4,
        difficultyRating: 3,
        usefulnessRating: 5,
        reviewText: 'Great subject but quite time-consuming. Make sure to start assignments early!',
        wouldRecommend: true,
        status: 'auto-approved' as const,
      },
      {
        unitId: createdUnits[1].id, // Data Structures
        userId: student1.id,
        sessionTaken: 'Spring 2024',
        displayNameType: 'anonymous' as const,
        customNickname: null,
        overallRating: 4,
        teachingQualityRating: 4,
        workloadRating: 5,
        difficultyRating: 4,
        usefulnessRating: 5,
        reviewText:
          'Challenging but rewarding. The content is very useful for technical interviews.',
        wouldRecommend: true,
        status: 'auto-approved' as const,
      },
      {
        unitId: createdUnits[2].id, // Web Systems
        userId: student2.id,
        sessionTaken: 'Autumn 2024',
        displayNameType: 'nickname' as const,
        customNickname: 'WebDev2024',
        overallRating: 5,
        teachingQualityRating: 5,
        workloadRating: 3,
        difficultyRating: 3,
        usefulnessRating: 5,
        reviewText: 'Loved this subject! Very practical and the projects were fun to build.',
        wouldRecommend: true,
        status: 'auto-approved' as const,
      },
    ];

    await db.insert(reviews).values(sampleReviews);

    console.log(`✓ Created ${sampleReviews.length} sample reviews`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\nTest Credentials:');
    console.log('  Admin: admin@uts.edu.au / password123');
    console.log('  Student 1: student1@student.uts.edu.au / password123');
    console.log('  Student 2: student2@student.uts.edu.au / password123');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
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
