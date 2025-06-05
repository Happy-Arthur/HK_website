// Updated ReviewList component with better refresh handling
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Review } from "@shared/schema";
import ReviewCard from "./review-card";
import ReviewForm from "./review-form";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import RatingDisplay from "../facilities/RatingDisplay";

interface ReviewListProps {
  facilityId: number;
}

export default function ReviewList({ facilityId }: ReviewListProps) {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [viewAll, setViewAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Query reviews with stronger refresh settings
  const reviewsQuery = useQuery<(Review & { username: string })[]>({
    queryKey: [`/api/facilities/${facilityId}/reviews`],
    enabled: !!facilityId && facilityId > 0,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Auto refresh every 5 seconds
    staleTime: 3000, // Consider data stale after 3 seconds
  });

  // Query average rating for display and rendering stars
  const ratingQuery = useQuery<{ rating: number | null; count: number }>({
    queryKey: [`/api/facilities/${facilityId}/rating`],
    enabled: !!facilityId && facilityId > 0,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Auto refresh every 5 seconds
    staleTime: 3000, // Consider data stale after 3 seconds
  });

  // Enhanced handle for review submission success
  const handleNewReviewSuccess = async () => {
    setIsRefreshing(true);
    setShowForm(false);

    try {
      // Force a complete refetch of reviews and rating
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facilityId}/reviews`],
        }),
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facilityId}/rating`],
        }),
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities/${facilityId}`],
        }),
        queryClient.invalidateQueries({
          queryKey: [`/api/facilities`],
        }),
      ]);

      // Actively refetch the data to ensure UI updates
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: [`/api/facilities/${facilityId}/reviews`],
        }),
        queryClient.refetchQueries({
          queryKey: [`/api/facilities/${facilityId}/rating`],
        }),
      ]);

      console.log("Reviews and ratings refreshed after submission");
    } catch (error) {
      console.error("Error refreshing reviews/ratings:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Manual refresh function for debugging or user-triggered refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: [`/api/facilities/${facilityId}/reviews`],
        }),
        queryClient.refetchQueries({
          queryKey: [`/api/facilities/${facilityId}/rating`],
        }),
      ]);
    } catch (error) {
      console.error("Manual refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Display only a subset of reviews unless viewAll is true
  const displayedReviews = viewAll
    ? reviewsQuery.data || []
    : (reviewsQuery.data || []).slice(0, 3);

  return (
    <div>
      <div className="flex justify-between mb-4 items-center">
        <h3 className="font-semibold text-lg">Reviews</h3>
        <div className="flex items-center">
          {isRefreshing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <RatingDisplay
            rating={ratingQuery.data?.rating || null}
            reviewCount={ratingQuery.data?.count || 0}
            size="sm"
          />
        </div>
      </div>

      {reviewsQuery.isLoading ? (
        <div className="py-4 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : reviewsQuery.data?.length === 0 ? (
        <div className="py-4 text-center text-gray-500 border-t border-b border-gray-200">
          <p>No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {displayedReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {reviewsQuery.data && reviewsQuery.data.length > 3 && !viewAll && (
            <Button
              variant="ghost"
              className="mt-2 text-primary w-full"
              onClick={() => setViewAll(true)}
            >
              View all {reviewsQuery.data.length} reviews
            </Button>
          )}

          {viewAll && reviewsQuery.data && reviewsQuery.data.length > 3 && (
            <Button
              variant="ghost"
              className="mt-2 text-primary w-full"
              onClick={() => setViewAll(false)}
            >
              Show less
            </Button>
          )}
        </>
      )}

      {!showForm && user && (
        <Button
          variant="outline"
          className="w-full mt-4"
          onClick={() => setShowForm(true)}
        >
          Write a Review
        </Button>
      )}

      {showForm && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Write Your Review</h4>
          <ReviewForm
            facilityId={facilityId}
            onSuccess={handleNewReviewSuccess}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {!user && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm text-center">
          <p>Please sign in to leave a review</p>
        </div>
      )}
    </div>
  );
}
