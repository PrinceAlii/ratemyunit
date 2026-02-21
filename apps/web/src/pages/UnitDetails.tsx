import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { ReviewForm } from '../components/ReviewForm';
import { StarRating } from '../components/StarRating';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useMemo, useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { ThumbsUp, ThumbsDown, Flag } from 'lucide-react';
import type { Unit, ReviewWithUser, UnitWithStats } from '@ratemyunit/types';
import { VerificationBadge } from '../components/VerificationBadge';
import { calculateAverages, formatRating } from '../lib/calculations';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PaginatedResponse<T> {
  data: T;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  };
}

export function UnitDetails() {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const identifier = unitId?.trim() || '';
  const identifierIsUuid = UUID_REGEX.test(identifier);

  const { data: searchResponse, isLoading: searchLoading } = useQuery({
    queryKey: ['unit-search', identifier],
    queryFn: () => api.get<PaginatedResponse<UnitWithStats[]>>('/api/units/search', {
      q: identifier,
      limit: 50,
    }),
    enabled: !!identifier && !identifierIsUuid,
  });

  const exactMatches = useMemo(() => {
    if (!searchResponse?.data || !identifier) return [];
    const lowered = identifier.toLowerCase();
    return searchResponse.data.filter((candidate) => candidate.unitCode.toLowerCase() === lowered);
  }, [searchResponse, identifier]);

  const resolvedId = identifierIsUuid
    ? identifier
    : exactMatches.length === 1
      ? exactMatches[0].id
      : null;

  const { data: unit, isLoading: unitLoading } = useQuery({
    queryKey: ['unit', resolvedId],
    queryFn: () => api.get<Unit>(`/api/units/${resolvedId}`),
    enabled: !!resolvedId,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', resolvedId],
    queryFn: () => api.get<ReviewWithUser[]>(`/api/units/${resolvedId}/reviews`),
    enabled: !!resolvedId && !!unit,
  });

  const voteMutation = useMutation({
    mutationFn: ({ reviewId, voteType }: { reviewId: string; voteType: 'helpful' | 'not_helpful' }) =>
      api.post(`/api/reviews/${reviewId}/vote`, { voteType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', resolvedId] });
      toast.success('Vote recorded');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record vote: ${error.message}`);
    },
  });

  const flagMutation = useMutation({
    mutationFn: (reviewId: string) =>
      api.post(`/api/reviews/${reviewId}/flag`, { reason: 'inappropriate' }),
    onSuccess: () => {
      toast.success('Review flagged for moderation');
      queryClient.invalidateQueries({ queryKey: ['reviews', resolvedId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to flag review: ${error.message}`);
    },
  });

  const showLoading = identifierIsUuid
    ? unitLoading
    : searchLoading || (resolvedId ? unitLoading : false);

  if (showLoading) {
    return (
      <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-12 w-3/4" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!identifierIsUuid && !searchLoading && exactMatches.length > 1) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Multiple units found</h2>
          <p className="text-muted-foreground">
            Select the correct university for "{identifier}".
          </p>
        </div>

        <div className="grid gap-4">
          {exactMatches.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => navigate(`/units/${candidate.id}`)}
              className="text-left border-4 border-foreground bg-card p-5 shadow-neo hover:translate-x-1 hover:translate-y-1 transition-transform"
            >
              <div className="flex items-center gap-3 text-sm font-bold uppercase text-muted-foreground">
                <span>{candidate.universityAbbr || candidate.universityName || 'University'}</span>
                {candidate.universityName && (
                  <>
                    <span>•</span>
                    <span>{candidate.universityName}</span>
                  </>
                )}
              </div>
              <div className="mt-2 text-xl font-black">{candidate.unitName}</div>
              <div className="mt-1 font-mono text-sm">{candidate.unitCode}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="container py-12 text-center">
        <h2 className="text-2xl font-bold mb-2">Unit not found</h2>
        <p className="text-muted-foreground">The unit "{identifier}" does not exist in our database.</p>
      </div>
    );
  }

  const averages = reviews ? calculateAverages(reviews) : null;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold uppercase text-muted-foreground">
                {unit.university?.name}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm font-bold uppercase text-muted-foreground">
                {unit.faculty}
              </span>
            </div>
            <div className="inline-block px-4 py-2 border-4 border-foreground bg-muted shadow-neo-sm mb-4">
              <h1 className="text-3xl md:text-4xl font-mono font-black">
                {unit.unitCode}
              </h1>
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-black uppercase mb-4">
              {unit.unitName}
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="bg-secondary text-secondary-foreground px-3 py-1 text-sm font-black uppercase border-3 border-foreground">
                {unit.creditPoints} CP
              </span>
              {averages && (
                <div className="flex items-center gap-2">
                   <StarRating value={averages.overall} readOnly />
                   <span className="font-black text-lg">{formatRating(averages.overall)}</span>
                   <span className="font-medium">({averages.count} reviews)</span>
                </div>
              )}
            </div>
          </div>

          <Button
            size="lg"
            onClick={() => setShowReviewForm(!showReviewForm)}
            variant={showReviewForm ? "outline" : "default"}
            className="md:min-w-[180px] h-14 text-lg border-4"
          >
            {showReviewForm ? 'Cancel Review' : 'Write a Review'}
          </Button>
        </div>

        <div className="border-l-4 border-primary pl-6 py-2">
          <p className="leading-relaxed text-lg font-medium max-w-3xl">
            {unit.description}
          </p>
        </div>
      </div>

      {averages && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 border-4 border-foreground bg-primary text-primary-foreground shadow-neo">
            <div className="text-4xl font-black mb-1">{formatRating(averages.overall)}</div>
            <div className="text-sm font-bold uppercase">Overall</div>
          </div>
          <div className="p-5 border-4 border-foreground bg-secondary text-secondary-foreground shadow-neo">
            <div className="text-4xl font-black mb-1">{formatRating(averages.teaching)}</div>
            <div className="text-sm font-bold uppercase">Teaching</div>
          </div>
          <div className="p-5 border-4 border-foreground bg-accent text-accent-foreground shadow-neo">
            <div className="text-4xl font-black mb-1">{formatRating(averages.workload)}</div>
            <div className="text-sm font-bold uppercase">Workload</div>
          </div>
          <div className="p-5 border-4 border-foreground bg-card shadow-neo">
            <div className="text-4xl font-black mb-1">{averages.count}</div>
            <div className="text-sm font-bold uppercase">Reviews</div>
          </div>
        </div>
      )}

      <hr className="border-t-4 border-foreground" />

      {showReviewForm && (
        <div className="mb-8">
          <ReviewForm 
            unitId={unit.id} 
            onSuccess={() => setShowReviewForm(false)} 
            onCancel={() => setShowReviewForm(false)}
          />
        </div>
      )}

      <div className="space-y-6">
        <h2 className="text-3xl font-display font-black uppercase">Student Reviews</h2>

        {reviewsLoading ? (
            <p className="font-medium">Loading reviews...</p>
        ) : !reviews || reviews.length === 0 ? (
            <div className="text-center py-12 border-4 border-foreground bg-muted shadow-neo">
                <p className="text-lg font-bold mb-4">No reviews yet.</p>
                <Button variant="outline" onClick={() => setShowReviewForm(true)} className="border-3">
                    Be the first to review
                </Button>
            </div>
        ) : (
            <div className="grid gap-6">
                {reviews.map((review, index) => (
                    <div
                      key={review.id}
                      className={`p-6 border-4 border-foreground bg-card space-y-4 ${
                        index % 2 === 0 ? 'shadow-neo' : 'shadow-neo-primary'
                      }`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-black text-2xl">
                                        {review.overallRating}/5
                                    </span>
                                    <StarRating value={review.overallRating} readOnly size="sm" />
                                    <span className="text-sm font-bold px-2 py-1 border-2 border-foreground">
                                        {review.wouldRecommend ? '✅ Recommends' : '❌ Not Recommended'}
                                    </span>
                                </div>
                                <div className="text-sm font-medium">
                                    Taken in {review.sessionTaken} • Posted by {review.user.displayName}
                                    {review.displayNameType === 'verified' &&
                                     review.user.emailVerified &&
                                     review.user.emailDomain?.endsWith('.edu.au') && (
                                      <VerificationBadge
                                        domainVerified={review.user.domainVerified}
                                        className="ml-1"
                                      />
                                    )}
                                </div>
                            </div>
                            <div className="text-xs font-bold text-muted-foreground">
                                {new Date(review.createdAt).toLocaleDateString()}
                            </div>
                        </div>

                        <p className="text-base leading-relaxed whitespace-pre-wrap font-medium">
                            {review.reviewText}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm p-4 border-3 border-foreground bg-muted">
                             <div>
                                 <span className="font-bold uppercase block text-xs mb-1">Teaching</span>
                                 <span className="font-black text-lg">{review.teachingQualityRating}/5</span>
                             </div>
                             <div>
                                 <span className="font-bold uppercase block text-xs mb-1">Workload</span>
                                 <span className="font-black text-lg">{review.workloadRating}/5</span>
                             </div>
                             <div>
                                 <span className="font-bold uppercase block text-xs mb-1">Difficulty</span>
                                 <span className="font-black text-lg">{review.difficultyRating}/5</span>
                             </div>
                             <div>
                                 <span className="font-bold uppercase block text-xs mb-1">Usefulness</span>
                                 <span className="font-black text-lg">{review.usefulnessRating}/5</span>
                             </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 gap-1.5 border-2 border-transparent hover:border-foreground"
                                    onClick={() => voteMutation.mutate({ reviewId: review.id, voteType: 'helpful' })}
                                    disabled={!user}
                                >
                                    <ThumbsUp className="h-4 w-4" />
                                    <span className="font-bold">Helpful</span>
                                    {review.voteCount > 0 && <span className="ml-0.5 font-black">{review.voteCount}</span>}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 gap-1.5 border-2 border-transparent hover:border-foreground"
                                    onClick={() => voteMutation.mutate({ reviewId: review.id, voteType: 'not_helpful' })}
                                    disabled={!user}
                                >
                                    <ThumbsDown className="h-4 w-4" />
                                </Button>
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 font-bold hover:text-destructive border-2 border-transparent hover:border-foreground"
                                onClick={() => {
                                    if (confirm('Are you sure you want to flag this review?')) {
                                        flagMutation.mutate(review.id);
                                    }
                                }}
                                disabled={!user}
                            >
                                <Flag className="h-4 w-4 mr-1.5" />
                                Flag
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
