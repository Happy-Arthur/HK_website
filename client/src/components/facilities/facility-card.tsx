import React from "react";
import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import RatingDisplay from "./RatingDisplay";

interface FacilityCardProps {
  facility: {
    id: number;
    name: string;
    type?: string;
    district?: string;
    openTime?: string;
    closeTime?: string;
    courts?: number;
    averageRating?: number;
    totalReviews?: number;
  };
  onClick: () => void;
}

export default function FacilityCard({ facility, onClick }: FacilityCardProps) {
  // Only fetch rating if facility doesn't already have it cached
  const { data: ratingData } = useQuery<{ rating: number | null }>({
    queryKey: [`/api/facilities/${facility.id}/rating`],
    enabled: facility.averageRating === undefined,
  });

  // Use the facility's cached rating if available, otherwise use the fetched rating
  const rating = facility.averageRating ?? ratingData?.rating ?? null;
  const reviewCount = facility.totalReviews ?? 0;

  const formatDistrict = (district: string | undefined): string => {
    if (!district) return "Unknown District";

    return district
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const isOpen = (): boolean => {
    if (!facility.openTime || !facility.closeTime) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Parse open time
    const [openHour, openMinute] = facility.openTime.split(":").map(Number);
    const [closeHour, closeMinute] = facility.closeTime.split(":").map(Number);

    // Convert to minutes for easier comparison
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    return (
      currentTimeInMinutes >= openTimeInMinutes &&
      currentTimeInMinutes <= closeTimeInMinutes
    );
  };

  const facilityTypeBadgeColor = () => {
    if (!facility.type) return "bg-gray-100 text-gray-800";

    switch (facility.type) {
      case "basketball":
        return "bg-orange-100 text-orange-800";
      case "soccer":
        return "bg-green-100 text-green-800";
      case "tennis":
        return "bg-blue-100 text-blue-800";
      case "badminton":
        return "bg-purple-100 text-purple-800";
      case "swimming":
        return "bg-blue-100 text-blue-800";
      case "running":
        return "bg-green-100 text-green-800";
      case "fitness":
        return "bg-red-100 text-red-800";
      case "sports_ground":
        return "bg-blue-100 text-blue-800";
      case "sports_centre":
        return "bg-violet-100 text-violet-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Safe function to format facility type with null/undefined check
  const formatFacilityType = (type: string | undefined): string => {
    if (!type) return "Unknown";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div
      className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between">
        <h3 className="font-semibold text-lg">{facility.name}</h3>
        <span
          className={`${isOpen() ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} text-xs px-2 py-1 rounded-full`}
        >
          {isOpen() ? "Open Now" : "Closed"}
        </span>
      </div>

      <div className="flex items-center mt-1 text-sm text-gray-500">
        <MapPin className="w-4 h-4 mr-1" />
        <span>{formatDistrict(facility.district)}</span>
      </div>

      <div className="flex items-center mt-2">
        <RatingDisplay rating={rating} reviewCount={reviewCount} size="sm" />
      </div>

      <div className="mt-2 flex space-x-2">
        <span
          className={`px-2 py-1 rounded-md text-xs ${facilityTypeBadgeColor()}`}
        >
          {formatFacilityType(facility.type)}
        </span>
        {facility.courts && (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-md text-xs">
            {facility.courts} Courts
          </span>
        )}
      </div>
    </div>
  );
}
