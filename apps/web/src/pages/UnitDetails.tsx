import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ReviewForm } from '../components/ReviewForm';
import { StarRating } from '../components/StarRating';
import { Button } from '../components/ui/button';
import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import type { Unit, Review } from '@ratemyunit/types';

// Helper to calculate average ratings
function calculateAverages(reviews: Review[]) {
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

  const { data: unit, isLoading: unitLoading } = useQuery({
    queryKey: ['unit', unitCode],
    queryFn: () => api.get<Unit>(`/api/units/${unitCode}`),
    enabled: !!unitCode,
  });

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', unit?.id],
    queryFn: () => api.get<Review[]>(`/api/units/${unitCode}/reviews`),
    enabled: !!unitCode && !!unit,
  });

  if (unitLoading) return <div className="container py-8 text-center">Loading unit...</div>;
  if (!unit) return <div className="container py-8 text-center">Unit not found</div>;

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
                                    Taken in {review.sessionTaken} • Posted by {
                                      // @ts-ignore - joined user object structure
                                      review.user?.displayName || 'Anonymous'
                                    }
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
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
