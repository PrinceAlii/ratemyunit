// User types
export type UserRole = 'student' | 'admin' | 'moderator';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  universityId: string;
  emailVerified: boolean;
  banned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  displayName: string | null;
  role: UserRole;
}

// University types
export interface University {
  id: string;
  name: string;
  abbreviation: string;
  emailDomain: string;
  websiteUrl: string | null;
  handbookUrl: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Unit types
export interface UnitSession {
  year: number;
  session: string;
  mode: string;
}

export interface Unit {
  id: string;
  universityId: string;
  unitCode: string;
  unitName: string;
  description: string | null;
  creditPoints: number | null;
  prerequisites: string | null;
  antiRequisites: string | null;
  sessions: UnitSession[];
  faculty: string | null;
  scrapedAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Academic Structure - new fields for UTS scraper
  level: number | null;
  corequisites: string | null;
  workload: number | null;
  assessmentStrategy: string | null;

  // Learning Outcomes - new fields for UTS scraper
  learningOutcomes: string[] | null;
  syllabus: string | null;

  // Status Tracking - new fields for UTS scraper
  approvalStatus: string | null;
  department: string | null;
  lastModifiedCourseLoop: Date | null;

  // Delivery Information - new fields for UTS scraper
  deliveryModes: string[] | null;
  
  // Joined Fields (Optional)
  universityName?: string;
  universityAbbr?: string;
  university?: University;
}

export interface UnitWithStats extends Unit {
  averageRating: number;
  totalReviews: number;
  recommendationRate: number;
}

// Review types
export type DisplayNameType = 'nickname' | 'anonymous' | 'verified';
export type ReviewStatus = 'approved' | 'flagged' | 'removed';

export interface Review {
  id: string;
  unitId: string;
  userId: string;
  sessionTaken: string;
  displayNameType: DisplayNameType;
  customNickname: string | null;
  overallRating: number;
  teachingQualityRating: number;
  workloadRating: number;
  difficultyRating: number;
  usefulnessRating: number;
  reviewText: string | null;
  wouldRecommend: boolean;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewWithDetails extends Review {
  unit: Unit;
  helpfulVotes: number;
  notHelpfulVotes: number;
  userVote: 'helpful' | 'not_helpful' | null;
  flagCount: number;
}

export interface PublicReview extends Omit<Review, 'userId'> {
  displayName: string;
  helpfulVotes: number;
  notHelpfulVotes: number;
  userVote?: 'helpful' | 'not_helpful' | null;
}

export interface ReviewWithUser extends Review {
  user: {
    displayName: string;
    role: UserRole;
  };
  voteCount: number;
}

// Vote types
export type VoteType = 'helpful' | 'not_helpful';

export interface ReviewVote {
  id: string;
  reviewId: string;
  userId: string;
  voteType: VoteType;
  createdAt: Date;
}

// Flag types
export type FlagReason = 'spam' | 'inappropriate' | 'inaccurate' | 'other';
export type FlagStatus = 'pending' | 'reviewed' | 'dismissed';

export interface ReviewFlag {
  id: string;
  reviewId: string;
  userId: string;
  reason: FlagReason;
  description: string | null;
  status: FlagStatus;
  createdAt: Date;
}

// Auth types
export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

// Subject Code Template types
export type TemplateType = 'range' | 'list' | 'pattern';

export interface SubjectCodeTemplate {
  id: string;
  universityId: string;
  name: string;
  templateType: TemplateType;
  startCode: string | null;
  endCode: string | null;
  codeList: string[] | null;
  pattern: string | null;
  description: string | null;
  faculty: string | null;
  active: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

export interface SubjectCodeTemplateWithUniversity extends SubjectCodeTemplate {
  universityName: string;
  universityAbbr: string;
}

export interface TemplatePreviewResponse {
  codes: string[];
  total: number;
  truncated: boolean;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
