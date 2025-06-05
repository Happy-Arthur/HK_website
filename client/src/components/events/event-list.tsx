import type { Event } from "@shared/schema";
import EventCard from "./event-card";
import { Loader2 } from "lucide-react";

interface EventListProps {
  events: Event[];
  isLoading: boolean;
  onSelectEvent?: (id: number) => void;
}

export default function EventList({ events, isLoading, onSelectEvent }: EventListProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <svg
          className="h-12 w-12 text-gray-400 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900">No events found</h3>
        <p className="text-sm text-gray-500 mt-1">
          Check back later or try different filters
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {events.map((event) => (
        // Make sure each event has a unique ID to use as a key
        <div 
          key={`event-${event.id}`} 
          onClick={() => onSelectEvent && onSelectEvent(event.id)}
          className="cursor-pointer"
        >
          <EventCard event={event} />
        </div>
      ))}
    </div>
  );
}
