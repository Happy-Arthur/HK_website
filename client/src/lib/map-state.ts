// client/src/lib/map-state.ts - Helper functions for map state events
/**
 * Helper functions to manage map state during operations like check-ins and reviews
 * This centralizes the event handling for map state preservation
 */

/**
 * Signal the start of an operation that should preserve map state
 * (like submitting a review or checking in)
 */
export function startMapPreservation(): void {
  console.log("Starting map state preservation");
  document.dispatchEvent(new Event("fetch-start"));
}

/**
 * Signal the end of an operation that preserved map state
 * This allows the map to resume normal behavior
 */
export function endMapPreservation(): void {
  console.log("Ending map state preservation");
  document.dispatchEvent(new Event("fetch-complete"));
}

/**
 * Executes a function while preserving the map state
 * Useful for wrapping API calls that would otherwise affect map zoom
 *
 * @param fn Function to execute with map state preserved
 * @returns Promise that resolves with the result of fn
 */
export async function withMapPreservation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    startMapPreservation();
    return await fn();
  } finally {
    endMapPreservation();
  }
}

// Example usage:
// Instead of:
//   document.dispatchEvent(new Event("fetch-start"));
//   try {
//     await someApiCall();
//   } finally {
//     document.dispatchEvent(new Event("fetch-complete"));
//   }
//
// You can use:
//   await withMapPreservation(async () => {
//     return await someApiCall();
//   });
