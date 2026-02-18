/**
 * Reusable test fixtures for deterministic test data.
 */

export const TEST_IDS = {
  user: '11111111-1111-4111-a111-111111111111',
  admin: '22222222-2222-4222-a222-222222222222',
  user2: '33333333-3333-4333-a333-333333333333',
  university: '44444444-4444-4444-a444-444444444444',
  university2: '55555555-5555-4555-a555-555555555555',
  unit: '66666666-6666-4666-a666-666666666666',
  review: '77777777-7777-4777-a777-777777777777',
  review2: '88888888-8888-4888-a888-888888888888',
  session: '99999999-9999-4999-a999-999999999999',
  token: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
  template: 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb',
} as const;

export const mockUser = {
  id: TEST_IDS.user,
  email: 'student@student.uts.edu.au',
  displayName: 'Test Student',
  role: 'student' as const,
  universityId: TEST_IDS.university,
  emailVerified: true,
  banned: false,
  domainVerified: true,
  passwordHash: '$argon2id$v=19$m=47104,t=3,p=1$hash',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  lastLoginAt: null,
  lastIp: null,
};

export const mockAdmin = {
  ...mockUser,
  id: TEST_IDS.admin,
  email: 'admin@uts.edu.au',
  displayName: 'Admin User',
  role: 'admin' as const,
};

export const mockUniversity = {
  id: TEST_IDS.university,
  name: 'University of Technology Sydney',
  abbreviation: 'UTS',
  emailDomain: 'student.uts.edu.au',
  websiteUrl: 'https://www.uts.edu.au',
  active: true,
  scraperType: 'courseloop' as const,
  scraperConfig: null,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const mockUnit = {
  id: TEST_IDS.unit,
  unitCode: '31251',
  unitName: 'Data Structures and Algorithms',
  description: 'Learn about data structures and algorithms.',
  faculty: 'Faculty of Engineering and IT',
  creditPoints: 6,
  active: true,
  universityId: TEST_IDS.university,
  scrapedAt: new Date('2025-06-01'),
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

export const mockReview = {
  id: TEST_IDS.review,
  unitId: TEST_IDS.unit,
  userId: TEST_IDS.user,
  sessionTaken: 'Autumn 2025',
  displayNameType: 'nickname' as const,
  customNickname: 'TestStudent',
  overallRating: 4,
  teachingQualityRating: 3,
  workloadRating: 4,
  difficultyRating: 3,
  usefulnessRating: 5,
  reviewText: 'Great unit overall. The content is well structured and the assignments are interesting.',
  wouldRecommend: true,
  status: 'auto-approved' as const,
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
};

export const mockSession = {
  id: TEST_IDS.session,
  userId: TEST_IDS.user,
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  fresh: false,
};
