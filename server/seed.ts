import { db } from "./db";
import { facilities, facilityTypes, districts, InsertFacility } from "@shared/schema";
import { sql } from "drizzle-orm";

// Sample Hong Kong sports facilities data - properly typed with schema types
const sampleFacilities: InsertFacility[] = [
  {
    name: "Victoria Park Basketball Courts",
    description: "Public basketball courts located in Victoria Park, one of the largest parks in Hong Kong Island.",
    type: "basketball" as typeof facilityTypes[number],
    district: "wanchai" as typeof districts[number],
    address: "Victoria Park, Causeway Bay, Hong Kong",
    latitude: 22.2829,
    longitude: 114.1883,
    openTime: "07:00:00",
    closeTime: "22:00:00",
    contactPhone: "+852 2890 3466",
    imageUrl: "https://www.lcsd.gov.hk/en/parks/vp/common/graphics/title_photo.jpg",
    courts: 6,
    amenities: ["water_fountains", "restrooms", "locker_rooms"],
    ageRestriction: "all_ages",
    genderSuitability: "all_genders"
  },
  {
    name: "Kowloon Tsai Park Soccer Pitch",
    description: "Professional soccer pitch with artificial turf, suitable for competition and practice.",
    type: "soccer" as typeof facilityTypes[number],
    district: "kowloon_city" as typeof districts[number],
    address: "13 Inverness Road, Kowloon City, Hong Kong",
    latitude: 22.3318,
    longitude: 114.1757,
    openTime: "07:00:00",
    closeTime: "22:00:00",
    contactPhone: "+852 2711 9836",
    imageUrl: "https://www.lcsd.gov.hk/en/parks/ktp/common/graphics/title_photo.jpg",
    courts: 1,
    amenities: ["changing_rooms", "restrooms", "spectator_seating"],
    ageRestriction: "all_ages",
    genderSuitability: "all_genders"
  },
  {
    name: "Morrison Hill Swimming Pool",
    description: "Indoor swimming pool complex with Olympic-size main pool and training facilities.",
    type: "swimming" as typeof facilityTypes[number],
    district: "wanchai" as typeof districts[number],
    address: "11 Sing Woo Road, Happy Valley, Hong Kong",
    latitude: 22.2768,
    longitude: 114.1772,
    openTime: "06:30:00",
    closeTime: "22:00:00",
    contactPhone: "+852 2574 5294",
    imageUrl: "https://www.lcsd.gov.hk/en/swimpool/common/graphics/10054_title.jpg",
    courts: 2,
    amenities: ["changing_rooms", "showers", "lockers", "heated_pool"],
    ageRestriction: "all_ages",
    genderSuitability: "all_genders"
  },
  {
    name: "Hong Kong Tennis Centre",
    description: "Professional tennis facility with multiple courts and training programs.",
    type: "tennis" as typeof facilityTypes[number],
    district: "kowloon_city" as typeof districts[number],
    address: "9-11 Cotton Tree Drive, Kowloon Tong, Hong Kong",
    latitude: 22.3370,
    longitude: 114.1774,
    openTime: "07:00:00",
    closeTime: "23:00:00",
    contactPhone: "+852 2338 4141",
    imageUrl: "https://www.lcsd.gov.hk/en/parks/kcytf/common/graphics/title_photo.jpg",
    courts: 8,
    amenities: ["pro_shop", "coaching", "changing_rooms", "tournament_facilities"],
    ageRestriction: "all_ages",
    genderSuitability: "all_genders"
  },
  {
    name: "Harbour Road Sports Centre",
    description: "Multi-purpose indoor sports center with badminton courts and other facilities.",
    type: "badminton" as typeof facilityTypes[number],
    district: "wanchai" as typeof districts[number],
    address: "27 Harbour Road, Wan Chai, Hong Kong",
    latitude: 22.2801,
    longitude: 114.1731,
    openTime: "07:00:00",
    closeTime: "23:00:00",
    contactPhone: "+852 2827 9684",
    imageUrl: "https://www.lcsd.gov.hk/en/indoorfac/common/graphics/harsc_title.jpg",
    courts: 12,
    amenities: ["changing_rooms", "restrooms", "equipment_rental"],
    ageRestriction: "all_ages",
    genderSuitability: "all_genders"
  },
  {
    name: "Bowen Road Fitness Trail",
    description: "Popular jogging and fitness trail with beautiful city views, exercise stations along the route.",
    type: "running" as typeof facilityTypes[number],
    district: "central" as typeof districts[number],
    address: "Bowen Road, Mid-levels, Hong Kong",
    latitude: 22.2718,
    longitude: 114.1577,
    openTime: "00:00:00",
    closeTime: "23:59:59",
    contactPhone: "+852 2800 0000",
    imageUrl: "https://www.lcsd.gov.hk/en/healthy/jogging/common/graphics/bowen_road_title.jpg",
    courts: 0,
    amenities: ["exercise_stations", "water_fountains", "scenic_views"],
    ageRestriction: "all_ages",
    genderSuitability: "all_genders"
  },
  {
    name: "Quarry Bay Park Fitness Center",
    description: "Modern fitness center with weight training equipment and cardio machines.",
    type: "fitness" as typeof facilityTypes[number],
    district: "eastern" as typeof districts[number],
    address: "Hoi Tai Street, Quarry Bay, Hong Kong",
    latitude: 22.2878,
    longitude: 114.2192,
    openTime: "06:30:00",
    closeTime: "22:00:00",
    contactPhone: "+852 2513 0577",
    imageUrl: "https://www.lcsd.gov.hk/en/parks/qbp/common/graphics/title_photo.jpg",
    courts: 0,
    amenities: ["weight_room", "cardio_machines", "personal_training", "showers"],
    ageRestriction: "16_plus",
    genderSuitability: "all_genders"
  }
];

// Main function to insert the sample data
async function seedFacilities() {
  try {
    // Check if we already have facilities data
    const existingCount = await db.select({ count: sql`count(*)::int` }).from(facilities);
    
    console.log("Existing facilities count:", existingCount[0].count, typeof existingCount[0].count);
    
    // Only seed if no facilities exist
    if (existingCount[0].count === 0) {
      console.log("Seeding facilities data...");
      
      // Let's try using the drizzle ORM insert method instead
      try {
        for (const facility of sampleFacilities) {
          await db.insert(facilities).values({
            name: facility.name,
            description: facility.description,
            type: facility.type,
            district: facility.district,
            address: facility.address,
            latitude: facility.latitude,
            longitude: facility.longitude,
            openTime: facility.openTime,
            closeTime: facility.closeTime,
            contactPhone: facility.contactPhone,
            imageUrl: facility.imageUrl,
            courts: facility.courts,
            amenities: facility.amenities,
            ageRestriction: facility.ageRestriction,
            genderSuitability: facility.genderSuitability
          });
          console.log(`Inserted facility: ${facility.name}`);
        }
      } catch (error) {
        console.error("Error during facility insertion:", error);
        throw error;
      }
      
      console.log("Successfully seeded facilities data!");
    } else {
      console.log("Facilities data already exists. Skipping seeding.");
    }
  } catch (error) {
    console.error("Error seeding facilities data:", error);
  }
}

// Export the function to be used in the main server file
export { seedFacilities };