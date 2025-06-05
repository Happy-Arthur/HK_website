import { Facility, Event, Review, EventRsvp, CheckIn, User } from "@shared/schema";

// Map Marker Types
export interface MarkerIconOptions {
  className: string;
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
}

// Facility Filter Types
export interface FacilityFilter {
  type?: string;
  district?: string;
  query?: string;
}

// Event Filter Types
export interface EventFilter {
  type?: string;
  from?: Date;
  to?: Date;
  facilityId?: number;
}

// Extended Types with UI-specific properties
export interface FacilityWithRating extends Facility {
  averageRating?: number;
  totalReviews?: number;
}

export interface EventWithParticipants extends Event {
  participants?: number;
  usersGoing?: (User & { status: string })[];
}

export interface ReviewWithUser extends Review {
  username: string;
}

// Auth Types
export interface LoginData {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  confirmPassword?: string;
  fullName?: string;
  email?: string;
}

// Navigation
export type ActiveTab = "facilities" | "events";
