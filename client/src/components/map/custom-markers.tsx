// Declare global Leaflet instance
declare global {
  interface Window {
    L: any;
  }
}

interface MarkerIconOptions {
  className: string;
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
}

export function createCustomMarker(type: string) {
  // Use the globally available Leaflet instance
  const L = window.L;

  if (!L) {
    console.error("Leaflet must be loaded before creating markers");
    return null;
  }

  // Default to 'unknown' if type is undefined or not recognized
  let iconClass = "";
  let iconColor = "";

  // Make sure type is a valid string before switching on it
  if (!type || typeof type !== "string") {
    type = "unknown";
  }

  switch (type) {
    case "basketball":
      iconClass = "fa-basketball";
      iconColor = "#F97316"; // orange-500
      break;
    case "soccer":
      iconClass = "fa-futbol";
      iconColor = "#22C55E"; // green-500
      break;
    case "swimming":
      iconClass = "fa-person-swimming";
      iconColor = "#0EA5E9"; // sky-500
      break;
    case "tennis":
      iconClass = "fa-table-tennis-paddle-ball";
      iconColor = "#FACC15"; // yellow-400
      break;
    case "badminton":
      iconClass = "fa-shuttlecock";
      iconColor = "#D946EF"; // fuchsia-500
      break;
    case "running":
      iconClass = "fa-person-running";
      iconColor = "#10B981"; // emerald-500
      break;
    case "fitness":
      iconClass = "fa-dumbbell";
      iconColor = "#EF4444"; // red-500
      break;
    case "sports_ground":
      iconClass = "fa-field";
      iconColor = "#3B82F6"; // blue-500
      break;
    case "sports_centre":
      iconClass = "fa-building";
      iconColor = "#8B5CF6"; // violet-500
      break;
    default:
      iconClass = "fa-location-dot";
      iconColor = "#6B7280"; // gray-500
  }

  try {
    // Enhanced marker with better visual distinction
    const options: MarkerIconOptions = {
      className: `marker-${type}`,
      html: `<div class="w-12 h-12 flex items-center justify-center bg-white rounded-full shadow-md" 
              style="border: 3px solid ${iconColor}">
              <i class="fa-solid ${iconClass} fa-lg" style="color: ${iconColor}"></i>
            </div>
            <div class="text-xs font-bold text-center mt-1" style="color: ${iconColor}; text-shadow: 0px 0px 3px white, 0px 0px 3px white;">
              ${type.charAt(0).toUpperCase() + type.slice(1)}
            </div>`,
      iconSize: [48, 62], // Increased size to accommodate label
      iconAnchor: [24, 32],
    };

    return L.divIcon(options);
  } catch (error) {
    console.error("Error creating custom marker:", error);
    // Return a simple default marker if custom marker creation fails
    return L.divIcon({
      className: "default-marker",
      html: `<div class="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-lg" 
              style="border: 3px solid #6B7280">
              <i class="fa-solid fa-location-dot fa-lg" style="color: #6B7280"></i>
            </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }
}
