import axios from 'axios';
import { db } from '../db';
import { facilities, events, approvalStatuses } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Service to fetch external facilities and events using the Perplexity API
 */
export class WebSearchService {
  private apiKey: string | undefined;
  private useMockData: boolean = false;

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    if (!this.apiKey) {
      console.warn('PERPLEXITY_API_KEY not found in environment variables. Using mock data instead.');
      this.useMockData = true;
    } else {
      console.log('Perplexity API key found, will use real data search');
    }
  }

  /**
   * Search for external facilities using Perplexity API or mock data
   */
  async searchExternalFacilities(type: string, district: string): Promise<any[]> {
    console.log(`Searching for external facilities with type: ${type}, district: ${district}`);
    
    if (this.useMockData) {
      console.log('Using mock data for facilities search');
      return this.getMockFacilities(type, district);
    }
    
    try {
      // Construct an appropriate search query based on the filters
      let query = 'List of sports facilities in Hong Kong';
      
      if (type && district) {
        query = `List of ${type} facilities in ${district}, Hong Kong with their name, address, and GPS coordinates`;
      } else if (type) {
        query = `List of ${type} facilities in Hong Kong with their name, address, and GPS coordinates`;
      } else if (district) {
        query = `List of sports facilities in ${district}, Hong Kong with their name, address, and GPS coordinates`;
      }
      
      console.log(`Making Perplexity API request with query: "${query}"`);
      
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that provides accurate information about sports facilities in Hong Kong. Return the information in a list format with name, address, facility type, district, latitude and longitude. Be precise with coordinates.'
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 2000,
          temperature: 0.2,
          frequency_penalty: 1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Perplexity API response received');
      
      const content = response.data.choices[0].message.content;
      
      // Parse the response content and extract facility information
      const facilities = this.parseFacilitiesFromResponse(content, type);
      
      return facilities;
    } catch (error) {
      console.error('Error calling Perplexity API for facilities search:', error);
      console.log('Falling back to mock data');
      return this.getMockFacilities(type, district);
    }
  }
  
  /**
   * Parse facility information from Perplexity API response
   */
  private parseFacilitiesFromResponse(content: string, defaultType: string): any[] {
    const facilities = [];
    const lines = content.split('\n');
    
    let currentFacility: any = null;
    
    for (const line of lines) {
      // Check if the line starts a new facility listing
      if (line.match(/^\d+\.\s/) || line.match(/^-\s/) || line.match(/^\*\s/)) {
        // If we have a facility in progress, save it before starting a new one
        if (currentFacility && currentFacility.name) {
          facilities.push(currentFacility);
        }
        
        currentFacility = {
          name: '',
          type: defaultType || 'other',
          district: '',
          address: '',
          latitude: 0,
          longitude: 0,
          description: '',
          searchSource: 'perplexity'
        };
        
        // Extract the name from the current line
        const nameParts = line.match(/^\d+\.\s+(.*)|^-\s+(.*)|^\*\s+(.*)/);
        if (nameParts) {
          currentFacility.name = (nameParts[1] || nameParts[2] || nameParts[3]).trim();
        }
      } 
      // Look for coordinates in the line
      else if (line.toLowerCase().includes('latitude') || line.toLowerCase().includes('longitude') || line.includes('coordinates')) {
        const latMatch = line.match(/latitude:?\s*([\d\.]+)/i);
        const lngMatch = line.match(/longitude:?\s*([\d\.]+)/i);
        
        if (latMatch) {
          currentFacility.latitude = parseFloat(latMatch[1]);
        }
        
        if (lngMatch) {
          currentFacility.longitude = parseFloat(lngMatch[1]);
        }
        
        // Try to match "coordinates: 22.xxx, 114.xxx" format
        const coordsMatch = line.match(/coordinates:?\s*([\d\.]+)[,\s]+([\d\.]+)/i);
        if (coordsMatch) {
          currentFacility.latitude = parseFloat(coordsMatch[1]);
          currentFacility.longitude = parseFloat(coordsMatch[2]);
        }
      }
      // Look for address information
      else if (line.toLowerCase().includes('address')) {
        const addressMatch = line.match(/address:?\s*(.*)/i);
        if (addressMatch) {
          currentFacility.address = addressMatch[1].trim();
        }
      }
      // Look for district information
      else if (line.toLowerCase().includes('district')) {
        const districtMatch = line.match(/district:?\s*(.*)/i);
        if (districtMatch) {
          currentFacility.district = this.normalizeDistrict(districtMatch[1].trim());
        }
      }
      // Look for facility type information
      else if (line.toLowerCase().includes('type')) {
        const typeMatch = line.match(/type:?\s*(.*)/i);
        if (typeMatch) {
          currentFacility.type = this.normalizeType(typeMatch[1].trim());
        }
      }
      // If none of the above, it might be additional description
      else if (line.trim() && currentFacility) {
        currentFacility.description += ' ' + line.trim();
      }
    }
    
    // Don't forget the last facility
    if (currentFacility && currentFacility.name) {
      facilities.push(currentFacility);
    }
    
    // Filter out facilities without proper coordinates
    return facilities.filter(f => 
      f.name && 
      f.latitude >= 22.0 && f.latitude <= 23.0 && 
      f.longitude >= 113.0 && f.longitude <= 115.0
    );
  }

  /**
   * Normalize district names to match our schema
   */
  private normalizeDistrict(district: string): string {
    district = district.toLowerCase();
    
    if (district.includes('central')) return 'central';
    if (district.includes('eastern')) return 'eastern';
    if (district.includes('southern')) return 'southern';
    if (district.includes('wan chai') || district.includes('wanchai')) return 'wanchai';
    if (district.includes('kowloon city')) return 'kowloon_city';
    if (district.includes('kwun tong')) return 'kwun_tong';
    if (district.includes('sham shui po')) return 'sham_shui_po';
    if (district.includes('wong tai sin')) return 'wong_tai_sin';
    if (district.includes('yau tsim mong')) return 'yau_tsim_mong';
    if (district.includes('islands')) return 'islands';
    if (district.includes('kwai tsing')) return 'kwai_tsing';
    if (district.includes('north')) return 'north';
    if (district.includes('sai kung')) return 'sai_kung';
    if (district.includes('sha tin')) return 'sha_tin';
    if (district.includes('tai po')) return 'tai_po';
    if (district.includes('tsuen wan')) return 'tsuen_wan';
    if (district.includes('tuen mun')) return 'tuen_mun';
    if (district.includes('yuen long')) return 'yuen_long';
    
    return 'central'; // Default to central if unknown
  }
  
  /**
   * Normalize facility types to match our schema
   */
  private normalizeType(type: string): string {
    type = type.toLowerCase();
    
    if (type.includes('basketball')) return 'basketball';
    if (type.includes('soccer') || type.includes('football')) return 'soccer';
    if (type.includes('tennis')) return 'tennis';
    if (type.includes('badminton')) return 'badminton';
    if (type.includes('swimming')) return 'swimming';
    if (type.includes('running') || type.includes('jogging')) return 'running';
    if (type.includes('fitness') || type.includes('gym')) return 'fitness';
    
    return 'other';
  }

  /**
   * Search for external events using Perplexity API or mock data
   */
  async searchExternalEvents(type: string, startDate?: string, endDate?: string, category?: string): Promise<any[]> {
    console.log(`Searching for external events with type: ${type}, dates: ${startDate} to ${endDate}, category: ${category}`);
    
    if (this.useMockData) {
      console.log('Using mock data for events search');
      return this.getMockEvents(type, category, startDate, endDate);
    }
    
    try {
      // Construct a search query based on the filters
      let query = 'List of upcoming sports events in Hong Kong';
      
      if (type) {
        query = `List of upcoming ${type} events in Hong Kong`;
      }
      
      if (category) {
        query += ` - ${category} events`;
      }
      
      if (startDate && endDate) {
        query += ` between ${startDate} and ${endDate}`;
      } else if (startDate) {
        query += ` after ${startDate}`;
      } else if (endDate) {
        query += ` before ${endDate}`;
      }
      
      console.log(`Making Perplexity API request with query: "${query}"`);
      
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: `You are a helpful assistant that provides accurate and detailed information about sports events in Hong Kong.

For each event, include the following fields in a structured format:
1. Name of the event
2. Date in YYYY-MM-DD format
3. Start time and end time in 24-hour format (HH:MM)
4. Location name and address
5. Sport type (basketball, tennis, swimming, etc.)
6. Event category (competition, lessons, watching a match, training, tournament, etc.)
7. Description of the event
8. Website URL for registration or more information
9. GPS coordinates (latitude and longitude)
10. Image URL if available
11. Skill level required (beginner, intermediate, advanced, expert, or all levels)
12. Maximum participants (if applicable)

Format each event consistently. Be precise with details, especially coordinates, dates, and URLs. Do not make up information if you don't have it.`
            },
            {
              role: 'user',
              content: query + " Include all available details for each event: name, date, time, location, sport type, category, description, website, coordinates, image URL, skill level, and maximum participants. Please list complete information for each event in a consistent format."
            }
          ],
          max_tokens: 2000,
          temperature: 0.2,
          frequency_penalty: 1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Perplexity API response received for events search');
      
      const content = response.data.choices[0].message.content;
      
      // Parse the response content and extract event information
      const events = this.parseEventsFromResponse(content, type, category);
      
      return events;
    } catch (error) {
      console.error('Error calling Perplexity API for events search:', error);
      console.log('Falling back to mock data for events');
      return this.getMockEvents(type, category, startDate, endDate);
    }
  }
  
  /**
   * Parse event information from Perplexity API response
   */
  private parseEventsFromResponse(content: string, defaultType: string, defaultCategory?: string): any[] {
    const events = [];
    const lines = content.split('\n');
    
    let currentEvent: any = null;
    let currentEventIndex: number = -1;
    let isPartOfPreviousEvent = false;
    
    // Try to identify multi-part events with pattern-matching
    // Example: "**Name:**", "**Date:**", "**Time:**", "**Location:**", etc.
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is an event title or beginning of a new full event 
      const isNewNumberedEvent = line.match(/^\d+\.\s/) !== null;
      const isNewBulletEvent = line.match(/^-\s/) !== null || line.match(/^\*\s/) !== null;
      const isNewEventSection = line.match(/\*\*([^:*]+):\*\*/) !== null;
      
      // Special pattern for event name section
      const isEventNameSection = line.match(/\*\*Name:\*\*/) !== null;
      
      if (isNewNumberedEvent || isNewBulletEvent || (isEventNameSection && !isPartOfPreviousEvent)) {
        // If we have an event in progress, save it before starting a new one
        if (currentEvent && currentEvent.name) {
          events.push(currentEvent);
          currentEventIndex = events.length - 1;
        }
        
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        // Create new event
        currentEvent = {
          name: '',
          eventDate: this.formatDateString(nextMonth), // Default to next month
          startTime: '09:00',
          endTime: '18:00',
          sportType: defaultType || 'other',
          category: defaultCategory || 'competition',
          description: '',
          skillLevel: 'all_levels',
          maxParticipants: 50,
          facilityId: null,
          searchSource: 'perplexity',
          website: null,
          latitude: null,
          longitude: null,
          imageUrl: null,
          location: {
            name: '',
            address: 'Hong Kong'
          }
        };
        
        // Extract the name from the current line
        let eventName = '';
        
        if (isNewNumberedEvent || isNewBulletEvent) {
          const nameParts = line.match(/^\d+\.\s+(.*)|^-\s+(.*)|^\*\s+(.*)/);
          if (nameParts) {
            eventName = (nameParts[1] || nameParts[2] || nameParts[3]).trim();
          }
          isPartOfPreviousEvent = false;
        } else if (isEventNameSection) {
          // Format: **Name:** Event Name
          const nameParts = line.match(/\*\*Name:\*\*\s*(.*)/i);
          if (nameParts) {
            eventName = nameParts[1].trim();
          }
          isPartOfPreviousEvent = true; // Following sections are likely part of this event
        }
        
        currentEvent.name = eventName;
      } 
      // Check for different sections of an event with "**Section:**" format
      else if (isNewEventSection) {
        isPartOfPreviousEvent = true; // This is part of a multi-section event
        
        const sectionMatch = line.match(/\*\*([^:*]+):\*\*\s*(.*)/i);
        if (sectionMatch && currentEvent) {
          const sectionType = sectionMatch[1].trim().toLowerCase();
          const sectionContent = sectionMatch[2].trim();
          
          switch (sectionType) {
            case 'date':
              const parsedDate = this.parseDate(sectionContent);
              if (parsedDate) {
                currentEvent.eventDate = this.formatDateString(parsedDate);
              }
              break;
              
            case 'time':
              const times = this.parseTimeRange(sectionContent);
              if (times.start) currentEvent.startTime = times.start;
              if (times.end) currentEvent.endTime = times.end;
              break;
              
            case 'location':
              if (currentEvent.location) {
                currentEvent.location.name = sectionContent;
                currentEvent.location.address = sectionContent + ', Hong Kong';
              }
              break;
              
            case 'type':
            case 'sport':
            case 'event type':
              currentEvent.sportType = this.normalizeType(sectionContent);
              break;
              
            case 'category':
            case 'event category':
              currentEvent.category = sectionContent.toLowerCase();
              break;
              
            case 'website':
            case 'url':
            case 'website url':
              const urlMatch = sectionContent.match(/(https?:\/\/[^\s]+)/);
              if (urlMatch) {
                currentEvent.website = urlMatch[0];
              }
              break;
              
            case 'coordinates':
              const coordsMatch = sectionContent.match(/([\d.-]+)\s*,\s*([\d.-]+)/);
              if (coordsMatch) {
                const lat = parseFloat(coordsMatch[1]);
                const lng = parseFloat(coordsMatch[2]);
                
                if (!isNaN(lat) && !isNaN(lng)) {
                  currentEvent.latitude = lat;
                  currentEvent.longitude = lng;
                  
                  // Also update location object
                  if (currentEvent.location) {
                    currentEvent.location.coordinates = {
                      latitude: lat,
                      longitude: lng
                    };
                  }
                }
              }
              break;
              
            case 'image':
            case 'photo':
            case 'image url':
              const imageMatch = sectionContent.match(/(https?:\/\/[^\s]+)/);
              if (imageMatch) {
                currentEvent.imageUrl = imageMatch[0];
              }
              break;
              
            default:
              // Additional info as description
              currentEvent.description += ' ' + line.trim();
          }
        }
      }
      // Handle old style date, time, location, etc. lines
      else if (line.toLowerCase().includes('date:')) {
        const dateMatch = line.match(/date:?\s*(.*)/i);
        if (dateMatch && currentEvent) {
          const dateString = dateMatch[1].trim();
          const parsedDate = this.parseDate(dateString);
          if (parsedDate) {
            currentEvent.eventDate = this.formatDateString(parsedDate);
          }
        }
      }
      else if (line.toLowerCase().includes('time:')) {
        const timeMatch = line.match(/time:?\s*(.*)/i);
        if (timeMatch && currentEvent) {
          const timeString = timeMatch[1].trim();
          const times = this.parseTimeRange(timeString);
          if (times.start) currentEvent.startTime = times.start;
          if (times.end) currentEvent.endTime = times.end;
        }
      }
      else if (line.toLowerCase().includes('location:')) {
        const locationMatch = line.match(/location:?\s*(.*)/i);
        if (locationMatch && currentEvent && currentEvent.location) {
          const locationString = locationMatch[1].trim();
          currentEvent.location.name = locationString;
          currentEvent.location.address = locationString + ', Hong Kong';
        }
      }
      else if (line.toLowerCase().includes('website:') || line.toLowerCase().includes('url:')) {
        const urlMatch = line.match(/(?:website|url):?\s*(https?:\/\/[^\s]+)/i);
        if (urlMatch && currentEvent) {
          currentEvent.website = urlMatch[1].trim();
        }
      }
      else if (line.toLowerCase().includes('coordinates:')) {
        const coordsMatch = line.match(/coordinates:?\s*([\d.-]+)\s*,\s*([\d.-]+)/i) || 
                           line.match(/(?:latitude|lat):?\s*([\d.-]+)(?:.*?)(?:longitude|lng|long):?\s*([\d.-]+)/i);
        
        if (coordsMatch && currentEvent) {
          const lat = parseFloat(coordsMatch[1]);
          const lng = parseFloat(coordsMatch[2]);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            currentEvent.latitude = lat;
            currentEvent.longitude = lng;
            
            // Also update location object
            if (currentEvent.location) {
              currentEvent.location.coordinates = {
                latitude: lat,
                longitude: lng
              };
            }
          }
        }
      }
      else if (line.toLowerCase().includes('image:') || line.toLowerCase().includes('photo:')) {
        const imageMatch = line.match(/(?:image|photo):?\s*(https?:\/\/[^\s]+)/i);
        if (imageMatch && currentEvent) {
          currentEvent.imageUrl = imageMatch[1].trim();
        }
      }
      // Check if the line contains a URL that might be a website
      else if (line.match(/https?:\/\/[^\s]+/) && !line.match(/(?:image|photo|url|website):/i) && currentEvent) {
        // This might be a standalone URL for the website
        const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch && !currentEvent.website) {
          currentEvent.website = urlMatch[1].trim();
        }
      }
      // If none of the above, it might be additional description
      else if (line.trim() && currentEvent) {
        currentEvent.description += ' ' + line.trim();
      }
    }
    
    // Don't forget the last event
    if (currentEvent && currentEvent.name) {
      events.push(currentEvent);
    }
    
    // Filter out any events that appear to be just fragments
    const filteredEvents = events.filter(event => {
      // Keep events that have at least a name and one of: date, time, or location
      return event.name && 
        (event.eventDate !== this.formatDateString(new Date()) || 
         event.location?.name || 
         event.website);
    });
    
    return filteredEvents;
  }
  
  /**
   * Parse a date string into a Date object
   */
  private parseDate(dateString: string): Date | null {
    // Try various date formats
    const formats = [
      /(\d{1,2})[-\/\s.](\d{1,2})[-\/\s.](\d{2,4})/, // DD-MM-YYYY or MM-DD-YYYY
      /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/, // Month DD, YYYY
      /(\d{1,2})(?:st|nd|rd|th)?\s+(\w+),?\s+(\d{4})/, // DD Month YYYY
    ];
    
    for (const format of formats) {
      const match = dateString.match(format);
      if (match) {
        const parts = match.slice(1, 4);
        
        // Check if the first part is a month name
        if (isNaN(parseInt(parts[0]))) {
          // Format: Month DD, YYYY
          const month = this.getMonthNumber(parts[0]);
          const day = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          
          if (month && day && year) {
            return new Date(year, month - 1, day);
          }
        } else if (isNaN(parseInt(parts[1]))) {
          // Format: DD Month YYYY
          const day = parseInt(parts[0]);
          const month = this.getMonthNumber(parts[1]);
          const year = parseInt(parts[2]);
          
          if (month && day && year) {
            return new Date(year, month - 1, day);
          }
        } else {
          // Format: DD-MM-YYYY or MM-DD-YYYY (assuming DD-MM-YYYY for non-US)
          const first = parseInt(parts[0]);
          const second = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          
          if (first && second && year) {
            if (first > 12) {
              // If the first number is > 12, it must be a day
              return new Date(year < 100 ? 2000 + year : year, second - 1, first);
            } else {
              // Assume DD-MM-YYYY for ambiguous dates (international format)
              return new Date(year < 100 ? 2000 + year : year, second - 1, first);
            }
          }
        }
      }
    }
    
    // If we couldn't parse the date, use a date next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth;
  }
  
  /**
   * Get month number (1-12) from month name
   */
  private getMonthNumber(monthName: string): number | null {
    const months: Record<string, number> = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12
    };
    
    const monthKey = monthName.toLowerCase().substring(0, 3);
    return months[monthKey] || null;
  }
  
  /**
   * Parse a time range string (e.g. "9:00 AM - 5:00 PM")
   */
  private parseTimeRange(timeString: string): { start: string, end: string } {
    const result = { start: '09:00', end: '18:00' };
    
    // Look for a time range with a hyphen
    const rangeMatch = timeString.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    
    if (rangeMatch) {
      const startTime = this.parseSingleTime(rangeMatch[1]);
      const endTime = this.parseSingleTime(rangeMatch[2]);
      
      if (startTime) result.start = startTime;
      if (endTime) result.end = endTime;
    } else {
      // If there's no range, look for a single time
      const singleMatch = timeString.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
      if (singleMatch) {
        const time = this.parseSingleTime(singleMatch[1]);
        if (time) {
          result.start = time;
          
          // If we only have a start time, set end time to 2 hours later
          const [hours, minutes] = time.split(':').map(Number);
          let endHours = hours + 2;
          if (endHours > 23) endHours = 23;
          result.end = `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }
    }
    
    return result;
  }
  
  /**
   * Parse a single time string to 24-hour format (e.g. "9:00 AM" to "09:00")
   */
  private parseSingleTime(timeString: string): string | null {
    // Match "9:00 AM", "9 AM", "9:00", "9", "14:00", etc.
    const match = timeString.match(/(\d{1,2})(?::(\d{2}))?(?:\s*(AM|PM))?/i);
    
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const period = match[3] ? match[3].toUpperCase() : null;
      
      // Convert to 24-hour format
      if (period === 'PM' && hours < 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    return null;
  }
  
  /**
   * Format a Date object to ISO date string (YYYY-MM-DD)
   */
  private formatDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Add an external facility to the database with pending status
   */
  async addExternalFacility(facilityData: any): Promise<number | null> {
    try {
      console.log('Adding external facility to database:', facilityData);
      
      // Ensure required fields are present
      if (!facilityData.name || !facilityData.type || !facilityData.district) {
        console.error('Missing required fields for facility');
        return null;
      }
      
      // Set approval status to pending for external data
      const [result] = await db.insert(facilities).values({
        name: facilityData.name,
        type: facilityData.type,
        district: facilityData.district,
        address: facilityData.address || '',
        latitude: facilityData.latitude || 0,
        longitude: facilityData.longitude || 0,
        description: facilityData.description || '',
        openTime: facilityData.openTime || null,
        closeTime: facilityData.closeTime || null,
        imageUrl: facilityData.imageUrl || null,
        amenities: facilityData.amenities || [],
        contactPhone: facilityData.contactPhone || null,
        approvalStatus: 'pending',
        searchSource: facilityData.searchSource || 'perplexity'
      }).returning({ id: facilities.id });
      
      console.log(`Added facility with ID: ${result.id}`);
      return result.id;
    } catch (error) {
      console.error('Error adding external facility:', error);
      return null;
    }
  }
  
  /**
   * Add an external event to the database with pending status
   */
  async addExternalEvent(eventData: any): Promise<number | null> {
    try {
      console.log('Adding external event to database:', eventData);
      
      // Ensure required fields are present
      if (!eventData.name || !eventData.eventDate || !eventData.startTime || !eventData.endTime) {
        console.error('Missing required fields for event');
        return null;
      }
      
      // Process location information
      let location = eventData.location || null;
      
      // If we have coordinates but no location object, create one
      if (!location && (eventData.latitude && eventData.longitude)) {
        location = {
          name: eventData.locationName || eventData.name,
          address: eventData.address || "Hong Kong",
          coordinates: {
            latitude: eventData.latitude,
            longitude: eventData.longitude
          }
        };
      } 
      // If we have a location object but coordinates are missing and provided separately
      else if (location && eventData.latitude && eventData.longitude && !location.coordinates) {
        location.coordinates = {
          latitude: eventData.latitude,
          longitude: eventData.longitude
        };
      }
      
      // Set approval status to pending for external data
      const [result] = await db.insert(events).values({
        name: eventData.name,
        eventDate: eventData.eventDate,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        sportType: eventData.sportType || 'other',
        description: eventData.description || '',
        skillLevel: eventData.skillLevel || 'all_levels',
        maxParticipants: eventData.maxParticipants || 50,
        facilityId: null, // External events might not have a facility ID initially
        approvalStatus: eventData.approvalStatus || 'pending',
        searchSource: eventData.searchSource || 'perplexity',
        website: eventData.website || null,
        imageUrl: eventData.imageUrl || null,
        location: location
      }).returning({ id: events.id });
      
      console.log(`Added event with ID: ${result.id}`);
      return result.id;
    } catch (error) {
      console.error('Error adding external event:', error);
      return null;
    }
  }
  
  /**
   * Approve a pending facility
   */
  async approveFacility(facilityId: number): Promise<boolean> {
    try {
      await db.update(facilities)
        .set({ approvalStatus: 'approved' })
        .where(eq(facilities.id, facilityId));
      return true;
    } catch (error) {
      console.error('Error approving facility:', error);
      return false;
    }
  }
  
  /**
   * Reject a pending facility
   */
  async rejectFacility(facilityId: number): Promise<boolean> {
    try {
      await db.update(facilities)
        .set({ approvalStatus: 'rejected' })
        .where(eq(facilities.id, facilityId));
      return true;
    } catch (error) {
      console.error('Error rejecting facility:', error);
      return false;
    }
  }
  
  /**
   * Approve a pending event
   */
  async approveEvent(eventId: number): Promise<boolean> {
    try {
      await db.update(events)
        .set({ approvalStatus: 'approved' })
        .where(eq(events.id, eventId));
      return true;
    } catch (error) {
      console.error('Error approving event:', error);
      return false;
    }
  }
  
  /**
   * Reject a pending event
   */
  async rejectEvent(eventId: number): Promise<boolean> {
    try {
      await db.update(events)
        .set({ approvalStatus: 'rejected' })
        .where(eq(events.id, eventId));
      return true;
    } catch (error) {
      console.error('Error rejecting event:', error);
      return false;
    }
  }

  /**
   * Mock data for facilities when API is not available
   */
  private getMockFacilities(type?: string, district?: string): any[] {
    const mockFacilities = [
      {
        name: 'Central Sports Center',
        type: 'basketball',
        district: 'central',
        address: '123 Central District, Hong Kong',
        latitude: 22.2830,
        longitude: 114.1571,
        description: 'A modern sports facility with basketball courts',
        searchSource: 'simulated'
      },
      {
        name: 'Kowloon Athletics Complex',
        type: 'running',
        district: 'kowloon_city',
        address: '45 Kowloon Street, Hong Kong',
        latitude: 22.3285,
        longitude: 114.1820,
        description: 'Running tracks and fitness facilities',
        searchSource: 'simulated'
      },
      {
        name: 'Victoria Tennis Club',
        type: 'tennis',
        district: 'wanchai',
        address: '78 Victoria Road, Wan Chai, Hong Kong',
        latitude: 22.2771,
        longitude: 114.1702,
        description: 'Premium tennis courts with coaching available',
        searchSource: 'simulated'
      },
      {
        name: 'Island Swimming Center',
        type: 'swimming',
        district: 'eastern',
        address: '90 Island Road, Eastern District, Hong Kong',
        latitude: 22.2864,
        longitude: 114.2218,
        description: 'Olympic-sized swimming pools and facilities',
        searchSource: 'simulated'
      },
      {
        name: 'Southside Soccer Fields',
        type: 'soccer',
        district: 'southern',
        address: '123 South Road, Southern District, Hong Kong',
        latitude: 22.2461,
        longitude: 114.1550,
        description: 'Multiple soccer fields with night lighting',
        searchSource: 'simulated'
      }
    ];
    
    // Filter by type and district if provided
    return mockFacilities.filter(facility => {
      if (type && facility.type !== type) return false;
      if (district && facility.district !== district) return false;
      return true;
    });
  }
  
  /**
   * Mock data for events when API is not available
   */
  private getMockEvents(type?: string, category?: string, startDate?: string, endDate?: string): any[] {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const mockEvents = [
      {
        name: 'Hong Kong Basketball Tournament',
        eventDate: this.formatDateString(nextMonth),
        startTime: '09:00',
        endTime: '18:00',
        sportType: 'basketball',
        category: 'competition',
        description: 'Annual basketball tournament for local teams',
        skillLevel: 'intermediate',
        maxParticipants: 120,
        searchSource: 'simulated'
      },
      {
        name: 'Community Tennis Day',
        eventDate: this.formatDateString(nextWeek),
        startTime: '10:00',
        endTime: '16:00',
        sportType: 'tennis',
        category: 'lessons',
        description: 'Open tennis day for all skill levels',
        skillLevel: 'all_levels',
        maxParticipants: 50,
        searchSource: 'simulated'
      },
      {
        name: 'Hong Kong Marathon',
        eventDate: this.formatDateString(nextMonth),
        startTime: '07:00',
        endTime: '14:00',
        sportType: 'running',
        category: 'competition',
        description: 'Annual city marathon through the streets of Hong Kong',
        skillLevel: 'all_levels',
        maxParticipants: 10000,
        searchSource: 'simulated'
      },
      {
        name: 'Water Polo Championship',
        eventDate: this.formatDateString(nextWeek),
        startTime: '13:00',
        endTime: '18:00',
        sportType: 'swimming',
        category: 'watching a match',
        description: 'Regional water polo championship',
        skillLevel: 'advanced',
        maxParticipants: 80,
        searchSource: 'simulated'
      },
      {
        name: 'Kids Football League',
        eventDate: this.formatDateString(nextWeek),
        startTime: '09:00',
        endTime: '12:00',
        sportType: 'soccer',
        description: 'Football league for children under 12',
        skillLevel: 'beginner',
        maxParticipants: 150,
        searchSource: 'simulated'
      }
    ];
    
    // Filter by type, category, and date range if provided
    return mockEvents.filter(event => {
      // Filter by type
      if (type && event.sportType !== type) return false;
      
      // Filter by category
      if (category && event.category !== category) return false;
      
      // Filter by date range
      if (startDate || endDate) {
        const eventDate = new Date(event.eventDate);
        
        if (startDate) {
          const startDateObj = new Date(startDate);
          if (eventDate < startDateObj) return false;
        }
        
        if (endDate) {
          const endDateObj = new Date(endDate);
          if (eventDate > endDateObj) return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Get all facilities with pending approval status
   */
  async getPendingFacilities(): Promise<any[]> {
    try {
      const pendingFacilities = await db
        .select()
        .from(facilities)
        .where(eq(facilities.approvalStatus, 'pending'));
      
      return pendingFacilities;
    } catch (error) {
      console.error('Error getting pending facilities:', error);
      return [];
    }
  }

  /**
   * Get all events with pending approval status
   */
  async getPendingEvents(): Promise<any[]> {
    try {
      const pendingEvents = await db
        .select()
        .from(events)
        .where(eq(events.approvalStatus, 'pending'));
      
      return pendingEvents;
    } catch (error) {
      console.error('Error getting pending events:', error);
      return [];
    }
  }

  /**
   * Get facility by ID
   */
  async getFacilityById(id: number): Promise<any> {
    try {
      const [facility] = await db
        .select()
        .from(facilities)
        .where(eq(facilities.id, id));
      
      return facility || null;
    } catch (error) {
      console.error('Error getting facility by ID:', error);
      return null;
    }
  }

  /**
   * Get event by ID
   */
  async getEventById(id: number): Promise<any> {
    try {
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, id));
      
      return event || null;
    } catch (error) {
      console.error('Error getting event by ID:', error);
      return null;
    }
  }
}



export const webSearchService = new WebSearchService();