import axios from 'axios';

/**
 * Service to fetch external events using Perplexity API or fallback to Google/DeepSeek AI
 */
export class ExternalSearchService {
  private googleApiKey: string | undefined;
  private googleSearchEngineId: string | undefined;
  private deepseekApiKey: string | undefined;
  private perplexityApiKey: string | undefined;
  private useMockData: boolean = false;
  private usePerplexityApi: boolean = false;

  constructor() {
    // Initialize API keys
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      console.log('GOOGLE_API_KEY or GOOGLE_SEARCH_ENGINE_ID not found. Using mock data for Google Search.');
      this.useMockData = true;
    }
    
    if (!this.deepseekApiKey) {
      console.log('DEEPSEEK_API_KEY not found. Using mock data for DeepSeek AI.');
      this.useMockData = true;
    }
    
    if (this.perplexityApiKey) {
      console.log('Perplexity API key found, will use real data search');
      this.usePerplexityApi = true;
    } else {
      console.log('Perplexity API key not found, will use mock data');
      this.useMockData = true;
    }
  }

  /**
   * Search for external events using Perplexity API for direct data generation
   */
  async searchExternalEvents(
    query: string,
    type?: string,
    category?: string,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    try {
      if (this.usePerplexityApi) {
        // Construct query with any filters
        let enhancedQuery = query;
        
        if (type) {
          enhancedQuery = `${type} ${enhancedQuery}`;
        }
        
        if (category) {
          enhancedQuery = `${category} ${enhancedQuery}`;
        }
        
        if (startDate) {
          enhancedQuery = `${enhancedQuery} from ${startDate}`;
        }
        
        if (endDate) {
          enhancedQuery = `${enhancedQuery} to ${endDate}`;
        }
        
        const content = await this.searchEventsWithPerplexity(enhancedQuery, type, category);
        return content;
      } else {
        console.log('Using mock data since no API keys are available');
        return this.getMockEvents(type, category, startDate, endDate);
      }
    } catch (error) {
      console.error('Error in external events search:', error);
      console.error('Cannot use mock data - returning empty array');
      return [];
    }
  }

  /**
   * Parse events from Perplexity API response text
   * Improved implementation that better extracts and consolidates event information
   * based on the format of the API response
   */
  private parseEventsFromResponse(content: string, defaultType?: string, defaultCategory?: string): any[] {
    console.log('Parsing events from Perplexity API response text');
    
    // Store events by name to avoid creating duplicates
    const eventMap = new Map<string, any>();
    const lines = content.split('\n');
    
    // Track the current event being built
    let currentEvent: any = null;
    let currentEventName: string | null = null;
    
    // Match patterns for date and time strings (e.g., "2025-04-12", "09:00 - 18:00")
    const datePattern = /(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})/;
    const timePattern = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/;
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Check if this is a numbered event (e.g., "1. Event Name")
      const numberedEventMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedEventMatch) {
        // Save previous event if it exists
        if (currentEvent && currentEventName) {
          this.saveEvent(eventMap, currentEventName, currentEvent);
        }
        
        // Start a new event
        currentEventName = numberedEventMatch[2];
        currentEvent = this.createNewEvent(currentEventName, defaultType, defaultCategory);
        continue;
      }
      
      // Check if this is a bulleted event (e.g., "* Event Name" or "- Event Name")
      const bulletedEventMatch = line.match(/^[-*]\s+(.+)$/);
      if (bulletedEventMatch) {
        // Save previous event if it exists
        if (currentEvent && currentEventName) {
          this.saveEvent(eventMap, currentEventName, currentEvent);
        }
        
        // Start a new event
        currentEventName = bulletedEventMatch[1];
        currentEvent = this.createNewEvent(currentEventName, defaultType, defaultCategory);
        continue;
      }
      
      // Special case for double asterisk title patterns that might be event names
      const titleMatch = line.match(/^\*\*([^*]+)\*\*$/);
      if (titleMatch && !line.includes(':')) {
        // Save previous event if it exists
        if (currentEvent && currentEventName) {
          this.saveEvent(eventMap, currentEventName, currentEvent);
        }
        
        // Start a new event with the title
        currentEventName = titleMatch[1].trim();
        currentEvent = this.createNewEvent(currentEventName, defaultType, defaultCategory);
        continue;
      }
      
      // Process key-value pairs for the current event
      if (currentEvent) {
        // Match key-value pairs with double asterisks (e.g., "**Date:** 2023-01-01")
        const keyValueMatch = line.match(/\*\*([^:]+):\*\*\s*(.+)/);
        if (keyValueMatch) {
          const key = keyValueMatch[1].toLowerCase().trim();
          const value = keyValueMatch[2].trim();
          
          // Process the field based on its key
          this.processEventField(currentEvent, key, value);
          continue;
        }
        
        // Check for date in the line (if the event doesn't have a date yet)
        if (!currentEvent.eventDate && datePattern.test(line)) {
          const dateMatch = line.match(datePattern);
          if (dateMatch && dateMatch[0]) {
            try {
              const date = new Date(dateMatch[0]);
              if (!isNaN(date.getTime())) {
                currentEvent.eventDate = this.formatDateString(date);
              }
            } catch (err) {
              // Ignore date parsing errors
            }
            continue;
          }
        }
        
        // Check for time range in the line (if the event doesn't have times yet)
        if ((!currentEvent.startTime || !currentEvent.endTime) && timePattern.test(line)) {
          const timeMatch = line.match(timePattern);
          if (timeMatch && timeMatch[1] && timeMatch[2]) {
            currentEvent.startTime = timeMatch[1];
            currentEvent.endTime = timeMatch[2];
            continue;
          }
        }
        
        // Check if this line contains location information
        if (line.toLowerCase().includes('location:') || line.toLowerCase().includes('venue:')) {
          const locationMatch = line.match(/(?:Location|Venue):\s*(.+)/i);
          if (locationMatch && locationMatch[1]) {
            if (!currentEvent.location) {
              currentEvent.location = { 
                name: locationMatch[1].trim(), 
                address: locationMatch[1].trim(),
                coordinates: {
                  latitude: 22.3193,
                  longitude: 114.1694
                }
              };
            } else {
              currentEvent.location.name = locationMatch[1].trim();
              currentEvent.location.address = locationMatch[1].trim();
            }
            continue;
          }
        }
        
        // If line doesn't match any pattern but has content, it might be description
        if (line && !line.match(/^[-*]$/) && !line.match(/^\d+\.$/)) {
          // Check if the line appears to be a description
          if (line.length > 10 && !line.includes('**') && !datePattern.test(line) && !timePattern.test(line)) {
            if (currentEvent.description) {
              currentEvent.description += ' ' + line;
            } else {
              currentEvent.description = line;
            }
          }
        }
      }
    }
    
    // Don't forget to add the last event
    if (currentEvent && currentEventName) {
      this.saveEvent(eventMap, currentEventName, currentEvent);
    }
    
    // Convert Map to array for final processing
    const uniqueEvents = Array.from(eventMap.values());
    console.log(`Found ${uniqueEvents.length} unique events after deduplication`);
    
    // Post-process events to ensure they have all required fields
    return uniqueEvents.map(event => this.finalizeEvent(event, defaultType, defaultCategory));
  }
  
  /**
   * Create a new event object with default values
   */
  private createNewEvent(name: string, defaultType?: string, defaultCategory?: string): any {
    return {
      name: name,
      sportType: defaultType || 'other',
      category: defaultCategory || 'competition',
      skillLevel: 'all_levels',
      searchSource: 'perplexity_api',
      startTime: '09:00',
      endTime: '18:00',
      location: {
        name: 'Hong Kong',
        address: 'Hong Kong',
        coordinates: {
          latitude: 22.3193,
          longitude: 114.1694
        }
      }
    };
  }
  
  /**
   * Process a single field of an event based on the key and value
   */
  private processEventField(event: any, key: string, value: string): void {
    switch (key) {
      case 'name':
        event.name = value;
        break;
      case 'date':
        try {
          const dateMatch = value.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            event.eventDate = dateMatch[1];
          } else {
            // Try other date formats
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              event.eventDate = this.formatDateString(date);
            }
          }
        } catch (err) {
          console.warn('Error parsing date:', value);
        }
        break;
      case 'time':
        const timeMatch = value.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if (timeMatch) {
          event.startTime = timeMatch[1];
          event.endTime = timeMatch[2];
        }
        break;
      case 'start time':
        const startTimeMatch = value.match(/(\d{1,2}:\d{2})/);
        if (startTimeMatch) event.startTime = startTimeMatch[1];
        break;
      case 'end time':
        const endTimeMatch = value.match(/(\d{1,2}:\d{2})/);
        if (endTimeMatch) event.endTime = endTimeMatch[1];
        break;
      case 'location':
        if (!event.location) {
          event.location = { 
            name: value, 
            address: value,
            coordinates: {
              latitude: 22.3193,
              longitude: 114.1694
            }
          };
        } else {
          event.location.name = value;
        }
        break;
      case 'address':
        if (!event.location) {
          event.location = { 
            name: "Hong Kong", 
            address: value,
            coordinates: {
              latitude: 22.3193,
              longitude: 114.1694
            }
          };
        } else {
          event.location.address = value;
        }
        break;
      case 'sport type':
      case 'sport':
        event.sportType = this.normalizeSportType(value);
        break;
      case 'category':
        event.category = this.normalizeEventCategory(value);
        break;
      case 'description':
        event.description = value;
        break;
      case 'website':
      case 'website url':
        event.website = value;
        break;
      case 'image url':
      case 'image':
        event.imageUrl = value;
        break;
      case 'coordinates':
      case 'gps coordinates':
        try {
          const coordMatch = value.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
          if (coordMatch) {
            if (!event.location) {
              event.location = {
                name: "Hong Kong",
                address: "Hong Kong"
              };
            }
            event.location.coordinates = {
              latitude: parseFloat(coordMatch[1]),
              longitude: parseFloat(coordMatch[2])
            };
          }
        } catch (err) {
          console.warn('Error parsing coordinates:', value);
        }
        break;
      case 'skill level':
        event.skillLevel = this.normalizeSkillLevel(value);
        break;
      case 'max participants':
      case 'maximum participants':
        try {
          const maxParts = parseInt(value);
          if (!isNaN(maxParts)) event.maxParticipants = maxParts;
        } catch (err) {
          console.warn('Error parsing max participants:', value);
        }
        break;
    }
  }
  
  /**
   * Save an event to the event map, merging with existing event if needed
   */
  private saveEvent(eventMap: Map<string, any>, eventName: string, event: any): void {
    if (!eventMap.has(eventName)) {
      eventMap.set(eventName, event);
    } else {
      // Update existing event
      const existingEvent = eventMap.get(eventName);
      Object.keys(event).forEach(key => {
        if (!existingEvent[key] && event[key]) {
          existingEvent[key] = event[key];
        }
      });
    }
  }
  
  /**
   * Finalize an event by ensuring all required fields are present
   */
  private finalizeEvent(event: any, defaultType?: string, defaultCategory?: string): any {
    // Process dates and times
    const eventDate = event.eventDate || this.formatDateString(new Date());
    const startTime = event.startTime || '09:00';
    const endTime = event.endTime || '18:00';
    
    // Process location
    let location = event.location || { 
      name: event.name || 'Hong Kong',
      address: 'Hong Kong',
      coordinates: {
        latitude: 22.3193,
        longitude: 114.1694
      }
    };
    
    // Set default coordinates if none present
    if (!location.coordinates) {
      location.coordinates = {
        latitude: 22.3193,
        longitude: 114.1694
      };
    }
    
    return {
      name: event.name,
      eventDate: eventDate,
      startTime: startTime,
      endTime: endTime,
      sportType: event.sportType || defaultType || 'other',
      category: event.category || defaultCategory || 'competition',
      description: event.description || '',
      skillLevel: event.skillLevel || 'all_levels',
      maxParticipants: event.maxParticipants || 50,
      website: event.website || null,
      imageUrl: event.imageUrl || null,
      location: location,
      searchSource: 'perplexity_api'
    };
  }
  
  /**
   * Normalize sport type to match our schema
   */
  private normalizeSportType(type: string): string {
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
   * Normalize event category to match our schema
   */
  private normalizeEventCategory(category: string): string {
    category = category.toLowerCase();
    
    if (category.includes('competition') || category.includes('tournament')) return 'competition';
    if (category.includes('lesson') || category.includes('training') || category.includes('class')) return 'lessons';
    if (category.includes('watching') || category.includes('spectator')) return 'watching';
    
    return 'competition';
  }
  
  /**
   * Normalize skill level to match our schema
   */
  private normalizeSkillLevel(level: string): string {
    level = level.toLowerCase();
    
    if (level.includes('beginner')) return 'beginner';
    if (level.includes('intermediate')) return 'intermediate';
    if (level.includes('advanced')) return 'advanced';
    if (level.includes('expert')) return 'expert';
    if (level.includes('all')) return 'all_levels';
    
    return 'all_levels';
  }
  
  /**
   * Search events using Perplexity API
   */
  private async searchEventsWithPerplexity(
    query: string,
    type?: string,
    category?: string
  ): Promise<any[]> {
    console.log(`Making Perplexity API request with query: "${query}"`);
    
    if (!this.perplexityApiKey) {
      console.error('Perplexity API key is not available. Cannot make API request.');
      throw new Error('Perplexity API key not configured');
    }
    
    try {
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
            'Authorization': `Bearer ${this.perplexityApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Perplexity API response received for events search');
      
      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        console.error('Invalid response structure from Perplexity API', response.data);
        throw new Error('Invalid response from Perplexity API');
      }
      
      const content = response.data.choices[0].message.content;
      
      // Parse the response content and extract event information
      const events = this.parseEventsFromResponse(content, type, category);
      console.log(`Successfully parsed ${events.length} events from Perplexity API response`);
      
      return events;
    } catch (error) {
      console.error('Error in Perplexity API search:', error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  /**
   * Format a Date object to ISO date string (YYYY-MM-DD)
   */
  private formatDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Mock data for events when APIs are not available
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
        searchSource: 'mock_data',
        location: {
          name: 'Hong Kong Coliseum',
          address: '9 Cheong Wan Road, Hung Hom, Hong Kong',
          coordinates: {
            latitude: 22.3028,
            longitude: 114.1827
          }
        },
        website: 'https://www.example.com/hk-basketball-tournament',
        imageUrl: 'https://example.com/images/basketball-event.jpg'
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
        searchSource: 'mock_data',
        location: {
          name: 'Victoria Park Tennis Courts',
          address: 'Victoria Park, Causeway Bay, Hong Kong',
          coordinates: {
            latitude: 22.2808,
            longitude: 114.1879
          }
        },
        website: 'https://www.example.com/tennis-day',
        imageUrl: 'https://example.com/images/tennis-event.jpg'
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
        searchSource: 'mock_data',
        location: {
          name: 'Victoria Park',
          address: 'Causeway Bay, Hong Kong',
          coordinates: {
            latitude: 22.2810,
            longitude: 114.1882
          }
        },
        website: 'https://www.example.com/hk-marathon',
        imageUrl: 'https://example.com/images/marathon-event.jpg'
      }
    ];
    
    // Filter by type, category, and date range if provided
    return mockEvents.filter((event: any) => {
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
}

export const externalSearchService = new ExternalSearchService();