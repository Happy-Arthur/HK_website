import { Facility } from "@shared/schema";
import FacilityCard from "./facility-card";
import { Loader2 } from "lucide-react";

interface FacilityListProps {
  facilities: Facility[];
  isLoading: boolean;
  onSelectFacility: (id: number) => void;
}

export default function FacilityList({ facilities, isLoading, onSelectFacility }: FacilityListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <svg className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12a4 4 0 100-8 4 4 0 000 8z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900">No facilities found</h3>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filter criteria</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {facilities.map((facility) => (
        <FacilityCard 
          key={facility.id} 
          facility={facility} 
          onClick={() => onSelectFacility(facility.id)} 
        />
      ))}
    </div>
  );
}
