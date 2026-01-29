import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Loader2 } from 'lucide-react';
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

interface ValidationErrors {
  sessionTaken?: string;
  overallRating?: string;
  reviewText?: string;
  customNickname?: string;
}

export function ReviewForm({ unitId, onSuccess, onCancel }: ReviewFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

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

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.sessionTaken.trim()) {
      errors.sessionTaken = 'Session taken is required';
    }

    if (formData.overallRating === 0) {
      errors.overallRating = 'Overall rating is required';
    }

    if (formData.reviewText.length < 50) {
      errors.reviewText = 'Review must be at least 50 characters';
    } else if (formData.reviewText.length > 2000) {
      errors.reviewText = 'Review must not exceed 2000 characters';
    }

    if (formData.displayNameType === 'nickname' && !formData.customNickname.trim()) {
      errors.customNickname = 'Nickname is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return api.post('/api/reviews', {
        unitId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', unitId] });
      toast.success('Review submitted successfully!');
      onSuccess?.();
    },
    onError: (err: Error) => {
      setError(err.message);
      toast.error(`Failed to submit review: ${err.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    mutation.mutate(formData);
  };

  if (!user) {
    return (
      <div className="p-6 text-center border-4 border-black rounded-none bg-card shadow-neo-lg">
        <p className="mb-4 font-bold text-foreground">Please login to write a review.</p>
        <Button disabled>Login to Review</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 border-4 border-black rounded-none bg-card shadow-neo-lg">
      <div className="space-y-2">
        <h3 className="text-lg font-bold uppercase">Write a Review</h3>
        <p className="text-sm font-medium text-muted-foreground">
          Share your experience with this unit to help other students.
        </p>
      </div>

      {error && (
        <div className="p-4 text-sm font-bold text-red-900 bg-red-100 border-3 border-red-600 rounded-none">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1">
                Overall Rating <span className="text-red-500">*</span>
              </Label>
              <StarRating
                value={formData.overallRating}
                onChange={(v) => {
                  setFormData({ ...formData, overallRating: v });
                  if (validationErrors.overallRating) {
                    setValidationErrors({ ...validationErrors, overallRating: undefined });
                  }
                }}
                readOnly={mutation.isPending}
              />
            </div>
            {validationErrors.overallRating && (
              <p className="text-sm font-bold text-red-900 mt-2 flex items-center gap-1 p-2 bg-red-100 border-2 border-red-600 rounded-none">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.overallRating}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Label>Teaching Quality</Label>
            <StarRating
              value={formData.teachingQualityRating}
              onChange={(v) => setFormData({ ...formData, teachingQualityRating: v })}
              readOnly={mutation.isPending}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Workload</Label>
            <StarRating
              value={formData.workloadRating}
              onChange={(v) => setFormData({ ...formData, workloadRating: v })}
              readOnly={mutation.isPending}
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Difficulty</Label>
            <StarRating
              value={formData.difficultyRating}
              onChange={(v) => setFormData({ ...formData, difficultyRating: v })}
              readOnly={mutation.isPending}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Usefulness</Label>
            <StarRating
              value={formData.usefulnessRating}
              onChange={(v) => setFormData({ ...formData, usefulnessRating: v })}
              readOnly={mutation.isPending}
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
                disabled={mutation.isPending}
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={!formData.wouldRecommend ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setFormData({ ...formData, wouldRecommend: false })}
                disabled={mutation.isPending}
              >
                No
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="session" className="flex items-center gap-1">
              Session Taken <span className="text-red-500">*</span>
            </Label>
            <input
              id="session"
              className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.sessionTaken ? 'border-red-500' : 'border-input'
              }`}
              placeholder="e.g. Autumn 2024"
              value={formData.sessionTaken}
              onChange={(e) => {
                setFormData({ ...formData, sessionTaken: e.target.value });
                if (validationErrors.sessionTaken) {
                  setValidationErrors({ ...validationErrors, sessionTaken: undefined });
                }
              }}
              disabled={mutation.isPending}
            />
            {validationErrors.sessionTaken && (
              <p className="text-sm font-bold text-red-900 flex items-center gap-1 p-2 bg-red-100 border-2 border-red-600 rounded-none">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.sessionTaken}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
             <Label htmlFor="display-type">Post as</Label>
             <select
                id="display-type"
                 className="flex h-10 w-full rounded-none border-3 border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-medium"
                 value={formData.displayNameType}
                 onChange={(e) => setFormData({ ...formData, displayNameType: e.target.value as 'nickname' | 'anonymous' | 'verified' })}
                 disabled={mutation.isPending}
             >
                 <option value="nickname">Nickname</option>
                 <option value="anonymous">Anonymous</option>
                 <option value="verified">Verified Name</option>
             </select>
          </div>
        </div>

        {formData.displayNameType === 'nickname' && (
          <div className="space-y-2">
            <Label htmlFor="nickname" className="flex items-center gap-1">
              Nickname <span className="text-red-500">*</span>
            </Label>
            <input
              id="nickname"
              className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.customNickname ? 'border-red-500' : 'border-input'
              }`}
              placeholder="CoolStudent123"
              value={formData.customNickname || ''}
              onChange={(e) => {
                setFormData({ ...formData, customNickname: e.target.value });
                if (validationErrors.customNickname) {
                  setValidationErrors({ ...validationErrors, customNickname: undefined });
                }
              }}
              disabled={mutation.isPending}
            />
            {validationErrors.customNickname && (
              <p className="text-sm font-bold text-red-900 flex items-center gap-1 p-2 bg-red-100 border-2 border-red-600 rounded-none">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.customNickname}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="review" className="flex items-center gap-1">
            Review <span className="text-red-500">*</span>
          </Label>
          <textarea
            id="review"
            className={`flex min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              validationErrors.reviewText ? 'border-red-500' : 'border-input'
            }`}
            placeholder="Share your thoughts about the unit..."
            value={formData.reviewText}
            onChange={(e) => {
              setFormData({ ...formData, reviewText: e.target.value });
              if (validationErrors.reviewText) {
                setValidationErrors({ ...validationErrors, reviewText: undefined });
              }
            }}
            disabled={mutation.isPending}
          />
          <div className="flex items-center justify-between">
            {validationErrors.reviewText && (
              <p className="text-sm font-bold text-red-900 flex items-center gap-1 p-2 bg-red-100 border-2 border-red-600 rounded-none">
                <AlertCircle className="h-3 w-3" />
                {validationErrors.reviewText}
              </p>
            )}
            <p className={`text-xs ml-auto ${
              formData.reviewText.length < 50
                ? 'text-orange-500'
                : formData.reviewText.length > 2000
                ? 'text-red-500'
                : 'text-muted-foreground'
            }`}>
              {formData.reviewText.length} / 2000 characters (min 50)
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {mutation.isPending ? 'Submitting...' : 'Submit Review'}
        </Button>
      </div>
    </form>
  );
}
