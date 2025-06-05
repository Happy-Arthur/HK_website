import { Review } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Star } from "lucide-react";

interface ReviewCardProps {
  review: Review & { username: string };
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const formatDate = (date: Date | null): string => {
    if (!date) return "Unknown date";
    return format(new Date(date), "MMM d, yyyy");
  };

  return (
    <div className="border-b border-gray-200 py-3">
      <div className="flex items-center">
        <Avatar className="w-8 h-8 mr-2">
          <AvatarFallback className="bg-primary text-white">
            {review.username ? review.username.charAt(0).toUpperCase() : "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{review.username}</div>
          <div className="text-xs text-gray-500">{formatDate(review.createdAt)}</div>
        </div>
        <div className="ml-auto flex text-amber-400">
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star}>
              {star <= review.rating ? (
                <Star className="w-4 h-4 fill-current" />
              ) : (
                <Star className="w-4 h-4 text-gray-300" />
              )}
            </span>
          ))}
        </div>
      </div>
      {review.comment && (
        <p className="mt-2 text-sm">{review.comment}</p>
      )}
    </div>
  );
}
