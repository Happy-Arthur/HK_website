/**
 * Constants shared across the application
 */

export const FACILITY_TYPES = [
  { value: 'basketball', label: 'Basketball' },
  { value: 'soccer', label: 'Soccer' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'badminton', label: 'Badminton' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'running', label: 'Running' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'other', label: 'Other' }
];

export const DISTRICTS = [
  { value: 'central', label: 'Central' },
  { value: 'eastern', label: 'Eastern' },
  { value: 'southern', label: 'Southern' },
  { value: 'wanchai', label: 'Wan Chai' },
  { value: 'kowloon_city', label: 'Kowloon City' },
  { value: 'kwun_tong', label: 'Kwun Tong' },
  { value: 'sham_shui_po', label: 'Sham Shui Po' },
  { value: 'wong_tai_sin', label: 'Wong Tai Sin' },
  { value: 'yau_tsim_mong', label: 'Yau Tsim Mong' },
  { value: 'islands', label: 'Islands' },
  { value: 'kwai_tsing', label: 'Kwai Tsing' },
  { value: 'north', label: 'North' },
  { value: 'sai_kung', label: 'Sai Kung' },
  { value: 'sha_tin', label: 'Sha Tin' },
  { value: 'tai_po', label: 'Tai Po' },
  { value: 'tsuen_wan', label: 'Tsuen Wan' },
  { value: 'tuen_mun', label: 'Tuen Mun' },
  { value: 'yuen_long', label: 'Yuen Long' }
];

export const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
  { value: 'all_levels', label: 'All Levels' }
];

export const APPROVAL_STATUSES = [
  { value: 'pending', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
];

export const CONNECTION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' }
];

export const RSVP_STATUSES = [
  { value: 'going', label: 'Going' },
  { value: 'interested', label: 'Interested' },
  { value: 'declined', label: 'Declined' }
];

export const EVENT_CATEGORIES = [
  { value: 'competition', label: 'Competition' },
  { value: 'lessons', label: 'Lessons' },
  { value: 'watching a match', label: 'Watching a Match' }
];

export const CROWD_LEVELS = [
  { value: 'empty', label: 'Empty', color: 'bg-green-100 text-green-800' },
  { value: 'quiet', label: 'Quiet', color: 'bg-green-200 text-green-800' },
  { value: 'moderate', label: 'Moderate', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'busy', label: 'Busy', color: 'bg-orange-100 text-orange-800' },
  { value: 'crowded', label: 'Crowded', color: 'bg-red-100 text-red-800' }
];

/**
 * Get label for a value from a collection of options
 */
export function getLabelFromValue(value: string | null | undefined, options: Array<{ value: string, label: string }>, defaultValue = 'Unknown'): string {
  if (!value) return defaultValue;
  const option = options.find(opt => opt.value === value);
  return option ? option.label : defaultValue;
}

/**
 * Get color class for a crowd level value
 */
export function getCrowdLevelColor(value: string | null | undefined, defaultColor = 'bg-gray-100 text-gray-800'): string {
  if (!value) return defaultColor;
  const level = CROWD_LEVELS.find(level => level.value === value);
  return level ? level.color : defaultColor;
}

/**
 * Format a date to a friendly string
 */
export function formatDate(date: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString();
}

/**
 * Format a time (HH:MM) to a friendly string
 */
export function formatTime(time: string): string {
  if (!time) return '';
  
  // Handle simple HH:MM format
  if (time.length === 5) {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  
  return time;
}

/**
 * Calculate crowd level based on the number of people and capacity
 */
export function calculateCrowdLevel(peopleCount: number, capacity = 20): string {
  const percentage = (peopleCount / capacity) * 100;
  
  if (percentage === 0) return 'empty';
  if (percentage < 25) return 'quiet';
  if (percentage < 50) return 'moderate';
  if (percentage < 75) return 'busy';
  return 'crowded';
}

/**
 * Convert a location's latitude/longitude to a human-readable name
 * (Placeholder - in a real app this would use a geocoding service)
 */
export function locationToName(latitude: number, longitude: number): string {
  // In a real app this would call a geocoding API
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * Calculate distance between two coordinates in kilometers
 */
export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance in a friendly way
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance.toFixed(1)} km`;
}