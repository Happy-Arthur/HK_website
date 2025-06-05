// client/src/components/reviews/review-form.tsx
import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ReviewFormProps {
  facilityId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ReviewForm({
  facilityId,
  onSuccess,
  onCancel,
}: ReviewFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to leave a review",
        variant: "destructive",
        duration: 5000, // Make error toasts stay longer
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating",
        variant: "destructive",
        duration: 5000, // Make error toasts stay longer
      });
      return;
    }

    setIsSubmitting(true);

    // Fire event to trigger map state preservation
    document.dispatchEvent(new Event("fetch-start"));

    try {
      console.log(`Submitting review for facility ID: ${facilityId}`, {
        rating,
        comment,
      });

      // Submit the review
      const response = await apiRequest(
        "POST",
        `/api/facilities/${facilityId}/reviews`,
        {
          rating,
          comment,
        },
      );

      console.log("Review submission successful:", response);

      // Aggressively invalidate all related queries to ensure UI updates
      await Promise.all([
        // Invalidate reviews list
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facilityId}/reviews`],
        }),

        // Invalidate rating data
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facilityId}/rating`],
        }),

        // Invalidate facility detail which includes rating
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facilityId}`],
        }),

        // Invalidate facilities list which might display ratings
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities`],
        }),
      ]);

      // Force immediate refetch of critical data
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: [`/api/facilities/${facilityId}/rating`],
        }),
        queryClient.refetchQueries({
          queryKey: [`/api/facilities/${facilityId}/reviews`],
        }),
      ]);

      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
        duration: 5000, // Make success toasts stay longer - 5 seconds
      });

      // Reset form
      setRating(0);
      setComment("");

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Review submission failed",
        description:
          "There was an error submitting your review. Please try again.",
        variant: "destructive",
        duration: 5000, // Make error toasts stay longer
      });
    } finally {
      setIsSubmitting(false);

      // Fire event to signal operation completion
      document.dispatchEvent(new Event("fetch-complete"));
    }
  };

  return (
    <form
      onSubmit={handleSubmitReview}
      className="border border-gray-200 rounded-md p-4"
    >
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Your Rating</label>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="text-2xl text-amber-400 focus:outline-none transition-colors"
            >
              <Star
                className={`h-6 w-6 ${star <= (hoverRating || rating) ? "fill-current" : ""}`}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <div className="text-sm mt-1 text-gray-600">
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent"}
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Your Review</label>
        <Textarea
          placeholder="Share your experience with this facility..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="h-24 resize-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || rating === 0}>
          {isSubmitting ? "Submitting..." : "Submit Review"}
        </Button>
      </div>
    </form>
  );
}
