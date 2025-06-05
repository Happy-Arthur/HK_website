/**
 * Web Search Routes
 * 
 * This file contains routes for web search functionality and admin approval workflow
 */

import { Express, Request, Response } from 'express';
import { webSearchService } from '../services/web-search-service';
import { externalSearchService } from '../services/external-search-service';
import { googlePlacesService } from '../services/google-places-service';

/**
 * Middleware to check if user is an admin
 */
function requireAdmin(req: Request, res: Response, next: Function) {
  const user = req.user as any;
  if (!user) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const ADMIN_USER_ID = 3; // Arthur's user ID (confirmed from database)
  
  // Check if the user is Arthur (ID 3) or has isAdmin flag
  if (user.isAdmin === true || user.id === ADMIN_USER_ID) {
    // If it's Arthur, ensure the isAdmin flag is set to true
    if (user.id === ADMIN_USER_ID && user.isAdmin !== true) {
      console.log(`Setting isAdmin=true for Arthur (ID: ${ADMIN_USER_ID})`);
      user.isAdmin = true;
    }
    
    console.log('Admin access granted for user:', user.username);
    next();
  } else {
    console.log('Admin access denied for user:', user);
    return res.status(403).json({ error: 'Admin access required' });
  }
}

/**
 * Register the web search routes
 */
export function registerWebSearchRoutes(app: Express, requireAuth: any) {
  /**
   * Get all pending facilities that need admin approval
   */
  app.get('/api/admin/pending/facilities', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const pendingFacilities = await webSearchService.getPendingFacilities();
      res.json(pendingFacilities);
    } catch (error) {
      console.error('Error getting pending facilities:', error);
      res.status(500).json({ error: 'Failed to get pending facilities' });
    }
  });

  /**
   * Get all pending events that need admin approval
   */
  app.get('/api/admin/pending/events', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const pendingEvents = await webSearchService.getPendingEvents();
      res.json(pendingEvents);
    } catch (error) {
      console.error('Error getting pending events:', error);
      res.status(500).json({ error: 'Failed to get pending events' });
    }
  });

  /**
   * Search for external facilities from web/APIs using Google Places API
   */
  app.get('/api/external/search/facilities', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { type, district } = req.query;
      console.log('Searching external facilities with:', { type, district });
      
      // Log Google Maps API key status (without revealing the key)
      console.log('Google Maps API key available?', !!(process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY));
      
      // Use Google Places API for facility search
      const facilities = await googlePlacesService.searchExternalFacilities(type as string, district as string);
      console.log(`Found ${facilities.length} external facilities from Google Places API`);
      res.json(facilities);
    } catch (error) {
      console.error('Error searching external facilities:', error);
      res.status(500).json({ error: 'Failed to search external facilities' });
    }
  });

  /**
   * Search for external events from web/APIs using Perplexity API
   */
  app.get('/api/external/search/events', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { type, startDate, endDate, category } = req.query;
      console.log('Searching external events with:', { type, startDate, endDate, category });
      
      // Log Perplexity API key status (without revealing the key)
      console.log('Perplexity API key available?', !!process.env.PERPLEXITY_API_KEY);
      
      const events = await externalSearchService.searchExternalEvents(
        type as string,
        startDate as string,
        endDate as string,
        category as string
      );
      console.log(`Found ${events.length} external events. Source: ${events.length > 0 ? events[0].searchSource : 'unknown'}`);
      res.json(events);
    } catch (error) {
      console.error('Error searching external events:', error);
      res.status(500).json({ error: 'Failed to search external events' });
    }
  });
  
  /**
   * Admin route to search for facilities from web/APIs using Google Places API
   */
  app.get('/api/admin/search/facilities', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { type, district } = req.query;
      console.log('Admin searching facilities with:', { type, district });
      
      // Log Google Maps API key status (without revealing the key)
      console.log('Google Maps API key available?', !!(process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY));
      
      // Use Google Places API for facility search
      const facilities = await googlePlacesService.searchExternalFacilities(type as string, district as string);
      console.log(`Found ${facilities.length} facilities for admin search from Google Places API`);
      res.json(facilities);
    } catch (error) {
      console.error('Error in admin search for facilities:', error);
      res.status(500).json({ error: 'Failed to search facilities' });
    }
  });

  /**
   * Admin route to search for events from web/APIs
   */
  app.get('/api/admin/search/events', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { type, from, to, category } = req.query;
      console.log('Admin searching events with:', { type, from, to, category });
      
      // Log Perplexity API key status (without revealing the key)
      console.log('Perplexity API key available?', !!process.env.PERPLEXITY_API_KEY);
      
      // Use externalSearchService instead of webSearchService to ensure we're using Perplexity API when available
      const events = await externalSearchService.searchExternalEvents(
        type as string,
        from as string,
        to as string,
        category as string
      );
      console.log(`Found ${events.length} events for admin search. Source: ${events.length > 0 ? events[0].searchSource : 'unknown'}`);
      res.json(events);
    } catch (error) {
      console.error('Error in admin search for events:', error);
      res.status(500).json({ error: 'Failed to search events' });
    }
  });

  /**
   * Add an external facility to the database with pending status
   */
  app.post('/api/external/add-facility', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const facilityData = req.body;
      console.log('Adding external facility with data:', facilityData);
      const facilityId = await webSearchService.addExternalFacility(facilityData);
      
      if (!facilityId) {
        return res.status(400).json({ error: 'Failed to add facility' });
      }
      
      console.log(`Successfully added external facility with ID: ${facilityId}`);
      res.status(201).json({ id: facilityId, message: 'Facility added with pending status' });
    } catch (error) {
      console.error('Error adding external facility:', error);
      res.status(500).json({ error: 'Failed to add external facility' });
    }
  });

  /**
   * Add an external event to the database with pending status
   */
  app.post('/api/external/add-event', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventData = req.body;
      console.log('Adding external event with data:', eventData);
      const eventId = await webSearchService.addExternalEvent(eventData);
      
      if (!eventId) {
        return res.status(400).json({ error: 'Failed to add event' });
      }
      
      console.log(`Successfully added external event with ID: ${eventId}`);
      res.status(201).json({ id: eventId, message: 'Event added with pending status' });
    } catch (error) {
      console.error('Error adding external event:', error);
      res.status(500).json({ error: 'Failed to add external event' });
    }
  });
  
  /**
   * Admin route to add an external facility to the database with pending status
   */
  app.post('/api/admin/facilities/add-external', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const facilityData = req.body;
      console.log('Admin adding external facility with data:', facilityData);
      const facilityId = await webSearchService.addExternalFacility(facilityData);
      
      if (!facilityId) {
        return res.status(400).json({ error: 'Failed to add facility' });
      }
      
      console.log(`Successfully added external facility with ID: ${facilityId}`);
      res.status(201).json({ id: facilityId, message: 'Facility added with pending status' });
    } catch (error) {
      console.error('Error adding external facility:', error);
      res.status(500).json({ error: 'Failed to add external facility' });
    }
  });

  /**
   * Admin route to add an external event to the database with pending status
   */
  app.post('/api/admin/events/add-external', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventData = req.body;
      console.log('Admin adding external event with data:', eventData);
      const eventId = await webSearchService.addExternalEvent(eventData);
      
      if (!eventId) {
        return res.status(400).json({ error: 'Failed to add event' });
      }
      
      console.log(`Successfully added external event with ID: ${eventId}`);
      res.status(201).json({ id: eventId, message: 'Event added with pending status' });
    } catch (error) {
      console.error('Error adding external event:', error);
      res.status(500).json({ error: 'Failed to add external event' });
    }
  });
  
  /**
   * Import an external facility directly
   */
  app.post('/api/external/import/facility', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const facilityData = req.body;
      console.log('Importing external facility with data:', facilityData);
      
      // Set approval status to approved for direct imports
      facilityData.approvalStatus = 'approved';
      
      const facilityId = await webSearchService.addExternalFacility(facilityData);
      
      if (!facilityId) {
        return res.status(400).json({ error: 'Failed to import facility' });
      }
      
      console.log(`Successfully imported external facility with ID: ${facilityId}`);
      
      // Get the full facility data to return
      const facility = await webSearchService.getFacilityById(facilityId);
      
      res.status(201).json({ 
        facility, 
        message: 'Facility imported successfully'
      });
    } catch (error) {
      console.error('Error importing external facility:', error);
      res.status(500).json({ error: 'Failed to import external facility' });
    }
  });

  /**
   * Import an external event directly
   */
  app.post('/api/external/import/event', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventData = req.body;
      console.log('Importing external event with data:', eventData);
      
      // Set approval status to approved for direct imports
      eventData.approvalStatus = 'approved';
      
      const eventId = await webSearchService.addExternalEvent(eventData);
      
      if (!eventId) {
        return res.status(400).json({ error: 'Failed to import event' });
      }
      
      console.log(`Successfully imported external event with ID: ${eventId}`);
      
      // Get the full event data to return
      const event = await webSearchService.getEventById(eventId);
      
      res.status(201).json({ 
        event, 
        message: 'Event imported successfully'
      });
    } catch (error) {
      console.error('Error importing external event:', error);
      res.status(500).json({ error: 'Failed to import external event' });
    }
  });

  /**
   * Approve a pending facility
   */
  app.post('/api/admin/approve-facility/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const facilityId = parseInt(req.params.id);
      const success = await webSearchService.approveFacility(facilityId);
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to approve facility' });
      }
      
      res.json({ message: 'Facility approved successfully' });
    } catch (error) {
      console.error('Error approving facility:', error);
      res.status(500).json({ error: 'Failed to approve facility' });
    }
  });

  /**
   * Reject a pending facility
   */
  app.post('/api/admin/reject-facility/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const facilityId = parseInt(req.params.id);
      const success = await webSearchService.rejectFacility(facilityId);
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to reject facility' });
      }
      
      res.json({ message: 'Facility rejected successfully' });
    } catch (error) {
      console.error('Error rejecting facility:', error);
      res.status(500).json({ error: 'Failed to reject facility' });
    }
  });

  /**
   * Approve a pending event
   */
  app.post('/api/admin/approve-event/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const success = await webSearchService.approveEvent(eventId);
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to approve event' });
      }
      
      res.json({ message: 'Event approved successfully' });
    } catch (error) {
      console.error('Error approving event:', error);
      res.status(500).json({ error: 'Failed to approve event' });
    }
  });

  /**
   * Reject a pending event
   */
  app.post('/api/admin/reject-event/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const success = await webSearchService.rejectEvent(eventId);
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to reject event' });
      }
      
      res.json({ message: 'Event rejected successfully' });
    } catch (error) {
      console.error('Error rejecting event:', error);
      res.status(500).json({ error: 'Failed to reject event' });
    }
  });
}