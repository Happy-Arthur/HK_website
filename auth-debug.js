// Simple script to debug authentication issues
const ARTHUR_ID = 3;

// Create fake JWT token with admin credentials for Arthur
const fakePayload = {
  id: ARTHUR_ID,
  username: "Arthur",
  fullName: "Arthur Chen",
  email: "arthur125a@gmail.com",
  isAdmin: true,
  preferredSports: ["basketball", "badminton", "swimming", "other"],
  skillLevel: {
    other: "expert",
    swimming: "expert",
    badminton: "beginner",
    basketball: "intermediate"
  },
  preferredLocations: ["north", "islands"],
  createdAt: "2025-04-24T09:10:32.345Z"
};

// Encode fakePayload to base64
const encodedPayload = Buffer.from(JSON.stringify(fakePayload)).toString('base64');

// Create a fake JWT token (header.payload.signature)
const fakeToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.fakesignature`;

console.log("=== AUTHENTICATION DEBUG INFO ===");
console.log("Fake auth token generated for testing:");
console.log(fakeToken);
console.log("\nTest this token using the following curl command:");
console.log(`curl -v -H "Authorization: Bearer ${fakeToken}" https://your-repl-url/api/admin/debug`);
console.log("\nFor use in browser console:");
console.log(`localStorage.setItem('auth_token', '${fakeToken}');`);
console.log("Then reload the page and try accessing the admin dashboard");