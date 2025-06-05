// client/src/components/facilities/RatingDisplay.tsx
import React from "react";
import { Star } from "lucide-react";

interface RatingDisplayProps {
  rating: number | null;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  showEmpty?: boolean;
  className?: string;
}

const RatingDisplay: React.FC<RatingDisplayProps> = ({
  rating,
  reviewCount = 0,
  size = "md",
  showEmpty = true,
  className = "",
}) => {
  // Size classes for the stars
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  // Don't show anything if no rating and showEmpty is false
  if (rating === null && !showEmpty) {
    return null;
  }

  // Make sure we have valid values to work with
  const normalizedRating =
    rating !== null && !isNaN(rating) ? Math.max(0, Math.min(5, rating)) : 0;

  const normalizedCount =
    typeof reviewCount === "number" && !isNaN(reviewCount)
      ? Math.max(0, reviewCount)
      : 0;

  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClasses[size]} ${normalizedRating >= star ? "fill-current" : "text-gray-300"}`}
          />
        ))}
      </div>

      {/* Always show the rating value */}
      <span className="ml-1 text-sm font-medium">
        {normalizedRating > 0 ? normalizedRating.toFixed(1) : "0.0"}
      </span>

      {/* Show review count if available */}
      {normalizedCount >= 0 && (
        <span className="ml-1 text-sm text-gray-500">({normalizedCount})</span>
      )}

      {/* Show "No ratings" message only when explicitly needed */}
      {normalizedRating === 0 && normalizedCount === 0 && showEmpty && (
        <span className="ml-1 text-xs text-gray-500">No ratings yet</span>
      )}
    </div>
  );
};

export default RatingDisplay;
