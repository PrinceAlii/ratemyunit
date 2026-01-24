import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { StarRating } from './StarRating';
import { useAuth } from '../lib/auth-context';

interface ReviewFormProps {
  unitId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReviewForm({ unitId, onSuccess, onCancel }: ReviewFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    sessionTaken: '',
    displayNameType: 'nickname' as 'nickname' | 'anonymous' | 'verified',
    customNickname: '',
    overallRating: 0,
    teachingQualityRating: 0,
    workloadRating: 0,
    difficultyRating: 0,
    usefulnessRating: 0,
    reviewText: '',
    wouldRecommend: true,
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate basic requirements locally
      if (!data.sessionTaken) throw new Error('Session taken is required');
      if (data.overallRating === 0) throw new Error('Overall rating is required');
      if (data.reviewText.length < 50) throw new Error('Review must be at least 50 characters');

      return api.post('/api/reviews', {
        unitId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', unitId] });
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate(formData);
  };

  if (!user) {
    return (
      <div className="p-6 text-center border rounded-lg bg-muted/50">
        <p className="mb-4 text-muted-foreground">Please login to write a review.</p>
        <Button disabled>Login to Review</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 border rounded-lg bg-card">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Write a Review</h3>
        <p className="text-sm text-muted-foreground">
          Share your experience with this unit to help other students.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {/* Ratings Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Overall Rating</Label>
            <StarRating
              value={formData.overallRating}
              onChange={(v) => setFormData({ ...formData, overallRating: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Teaching Quality</Label>
            <StarRating
              value={formData.teachingQualityRating}
              onChange={(v) => setFormData({ ...formData, teachingQualityRating: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Workload</Label>
            <StarRating
              value={formData.workloadRating}
              onChange={(v) => setFormData({ ...formData, workloadRating: v })}
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Difficulty</Label>
            <StarRating
              value={formData.difficultyRating}
              onChange={(v) => setFormData({ ...formData, difficultyRating: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Usefulness</Label>
            <StarRating
              value={formData.usefulnessRating}
              onChange={(v) => setFormData({ ...formData, usefulnessRating: v })}
            />
          </div>
          <div className="flex items-center justify-between py-1">
            <Label>Would Recommend?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.wouldRecommend ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData({ ...formData, wouldRecommend: true })}
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={!formData.wouldRecommend ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setFormData({ ...formData, wouldRecommend: false })}
              >
                No
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Details */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="session">Session Taken</Label>
            <input
              id="session"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="e.g. Autumn 2024"
              value={formData.sessionTaken}
              onChange={(e) => setFormData({ ...formData, sessionTaken: e.target.value })}
              required
            />
          </div>
          
          <div className="space-y-2">
             <Label htmlFor="display-type">Post as</Label>
             <select
                id="display-type"
                 className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                 value={formData.displayNameType}
                 onChange={(e) => setFormData({ ...formData, displayNameType: e.target.value as any })}
             >
                 <option value="nickname">Nickname</option>
                 <option value="anonymous">Anonymous</option>
                 <option value="verified">Verified Name</option>
             </select>
          </div>
        </div>

        {formData.displayNameType === 'nickname' && (
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
             <input
              id="nickname"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="CoolStudent123"
              value={formData.customNickname || ''}
              onChange={(e) => setFormData({ ...formData, customNickname: e.target.value })}
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="review">Review</Label>
          <textarea
            id="review"
             className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Share your thoughts about the unit..."
            value={formData.reviewText}
            onChange={(e) => setFormData({ ...formData, reviewText: e.target.value })}
            required
            minLength={50}
          />
          <p className="text-xs text-muted-foreground text-right">
            {formData.reviewText.length} / 2000 characters (min 50)
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Submitting...' : 'Submit Review'}
        </Button>
      </div>
    </form>
  );
}
