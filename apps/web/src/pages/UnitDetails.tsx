import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { ReviewForm } from '../components/ReviewForm';
import { StarRating } from '../components/StarRating';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { LoadingSpinner } from '../components/ui/loading-spinner';
import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { ThumbsUp, ThumbsDown, Flag } from 'lucide-react';
import type { Unit, ReviewWithUser } from '@ratemyunit/types';

// Helper to calculate average ratings.
function calculateAverages(reviews: ReviewWithUser[]) {
  if (!reviews.length) return null;

  const sum = reviews.reduce((acc, review) => ({
    overall: acc.overall + review.overallRating,
    teaching: acc.teaching + review.teachingQualityRating,
    workload: acc.workload + review.workloadRating,
    difficulty: acc.difficulty + review.difficultyRating,
    usefulness: acc.usefulness + review.usefulnessRating,
  }), { overall: 0, teaching: 0, workload: 0, difficulty: 0, usefulness: 0 });

  return {
    overall: (sum.overall / reviews.length).toFixed(1),
    teaching: (sum.teaching / reviews.length).toFixed(1),
    workload: (sum.workload / reviews.length).toFixed(1),
    difficulty: (sum.difficulty / reviews.length).toFixed(1),
    usefulness: (sum.usefulness / reviews.length).toFixed(1),
    count: reviews.length
  };
}

export function UnitDetails() {
  const { unitCode } = useParams<{ unitCode: string }>();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: unit, isLoading: unitLoading } = useQuery({
    queryKey: ['unit', unitCode],
    queryFn: () => api.get<Unit>(`/api/units/${unitCode}`),
    enabled: !!unitCode,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', unit?.id],
    queryFn: () => api.get<ReviewWithUser[]>(`/api/units/${unitCode}/reviews`),
    enabled: !!unitCode && !!unit,
  });

  const voteMutation = useMutation({
    mutationFn: ({ reviewId, voteType }: { reviewId: string; voteType: 'helpful' | 'not_helpful' }) =>
      api.post(`/api/reviews/${reviewId}/vote`, { voteType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', unit?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['reviews', unit?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to flag review: ${error.message}`);
    },
  });

  if (unitLoading) {
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
  if (!unit) return (
    <div className="container py-12 text-center">
      <h2 className="text-2xl font-bold mb-2">Unit not found</h2>
      <p className="text-muted-foreground">The unit "{unitCode}" does not exist in our database.</p>
    </div>
  );

  const averages = reviews ? calculateAverages(reviews) : null;

  return (
    <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-1">
              {unit.faculty}
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              {unit.unitCode} {unit.unitName}
            </h1>
            <div className="flex items-center gap-4">
              <span className="bg-secondary px-2 py-1 rounded text-sm font-medium">
                {unit.creditPoints} CP
              </span>
              {averages && (
                <div className="flex items-center gap-2">
                   <StarRating value={Number(averages.overall)} readOnly />
                   <span className="font-bold text-lg">{averages.overall}</span>
                   <span className="text-muted-foreground">({averages.count} reviews)</span>
                </div>
              )}
            </div>
          </div>
          
          <Button 
            size="lg" 
            onClick={() => setShowReviewForm(!showReviewForm)}
            variant={showReviewForm ? "outline" : "default"}
          >
            {showReviewForm ? 'Cancel Review' : 'Write a Review'}
          </Button>
        </div>

        <p className="text-muted-foreground leading-relaxed max-w-3xl">
          {unit.description}
        </p>
      </div>

      <hr />

      {/* Review Form */}
      {showReviewForm && (
        <div className="mb-8">
          <ReviewForm 
            unitId={unit.id} 
            onSuccess={() => setShowReviewForm(false)} 
            onCancel={() => setShowReviewForm(false)}
          />
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Student Reviews</h2>
        
        {reviewsLoading ? (
            <p>Loading reviews...</p>
        ) : !reviews || reviews.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
                <p className="text-lg text-muted-foreground mb-4">No reviews yet.</p>
                <Button variant="outline" onClick={() => setShowReviewForm(true)}>
                    Be the first to review
                </Button>
            </div>
        ) : (
            <div className="grid gap-6">
                {reviews.map((review) => (
                    <div key={review.id} className="p-6 border rounded-lg bg-card space-y-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-lg">
                                        {review.overallRating}/5
                                    </span>
                                    <StarRating value={review.overallRating} readOnly size="sm" />
                                    <span className="text-sm font-medium ml-2">
                                        {review.wouldRecommend ? '✅ Recommends' : '❌ Does not recommend'}
                                    </span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    Taken in {review.sessionTaken} • Posted by {review.user.displayName}
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {new Date(review.createdAt).toLocaleDateString()}
                            </div>
                        </div>

                        <p className="text-base leading-relaxed whitespace-pre-wrap">
                            {review.reviewText}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/50 p-3 rounded">
                             <div>
                                 <span className="text-muted-foreground block">Teaching</span>
                                 <span className="font-medium">{review.teachingQualityRating}/5</span>
                             </div>
                             <div>
                                 <span className="text-muted-foreground block">Workload</span>
                                 <span className="font-medium">{review.workloadRating}/5</span>
                             </div>
                             <div>
                                 <span className="text-muted-foreground block">Difficulty</span>
                                 <span className="font-medium">{review.difficultyRating}/5</span>
                             </div>
                             <div>
                                 <span className="text-muted-foreground block">Usefulness</span>
                                 <span className="font-medium">{review.usefulnessRating}/5</span>
                             </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5"
                                    onClick={() => voteMutation.mutate({ reviewId: review.id, voteType: 'helpful' })}
                                    disabled={!user}
                                >
                                    <ThumbsUp className="h-4 w-4" />
                                    <span>Helpful</span>
                                    {review.voteCount > 0 && <span className="ml-0.5 font-bold">{review.voteCount}</span>}
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 gap-1.5"
                                    onClick={() => voteMutation.mutate({ reviewId: review.id, voteType: 'not_helpful' })}
                                    disabled={!user}
                                >
                                    <ThumbsDown className="h-4 w-4" />
                                </Button>
                            </div>
                            
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-muted-foreground hover:text-destructive"
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
