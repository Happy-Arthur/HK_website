/**
 * Routes for external search functionality
 * These endpoints handle integration with external data sources for facility and event data
 */

import { Router, Request, Response } from 'express';
import { webSearchService } from '../services/web-search-service';

export function registerExternalSearchRoutes(app: Router, requireAuth: any) {
  // Create a router to handle API requests for external search
  const router = Router();
  
  // Search external facilities (GET /api/external/search/facilities)
  router.get('/search/facilities', async (req: Request, res: Response) => {
    try {
      const { type, district, query } = req.query;
      console.log(`Searching external facilities with params:`, { query, type, district });
      
      const facilities = await webSearchService.searchExternalFacilities(
        type as string,
        district as string
      );
      
      console.log(`Found ${facilities.length} external facilities matching criteria`);
      res.json({
        success: true,
        results: facilities
      });
    } catch (error) {
      console.error('Error searching external facilities:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search external facilities'
      });
    }
  });
  
  // Search external events (GET /api/external/search/events)
  router.get('/search/events', async (req: Request, res: Response) => {
    try {
      const { type } = req.query;
      console.log(`Searching external events with params:`, { type });
      
      const events = await webSearchService.searchExternalEvents(type as string);
      
      console.log(`Found ${events.length} external events matching criteria`);
      res.json({
        success: true,
        results: events
      });
    } catch (error) {
      console.error('Error searching external events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search external events'
      });
    }
  });
  
  // Import external facility (POST /api/external/import/facility)
  router.post('/import/facility', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const facilityData = req.body;
      console.log(`Importing external facility: ${facilityData.name}`);
      
      // Check if the facility already exists (by name)
      // This is handled in the service
      
      const facilityId = await webSearchService.addExternalFacility(facilityData);
      
      if (!facilityId) {
        console.log(`Facility already exists or failed to import: ${facilityData.name}`);
        return res.status(400).json({
          success: false,
          message: 'Facility already exists or could not be imported'
        });
      }
      
      console.log(`Successfully imported facility with ID: ${facilityId}`);
      res.status(201).json({
        success: true,
        facility: {
          id: facilityId,
          name: facilityData.name,
          status: 'pending'
        },
        message: 'Facility imported successfully (pending approval)'
      });
    } catch (error) {
      console.error('Error importing external facility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import facility'
      });
    }
  });
  
  // Import external event (POST /api/external/import/event)
  router.post('/import/event', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const eventData = req.body;
      console.log(`Importing external event: ${eventData.name}`);
      
      // Check if the event already exists (by name)
      // This is handled in the service
      
      const eventId = await webSearchService.addExternalEvent(eventData);
      
      if (!eventId) {
        console.log(`Event already exists or failed to import: ${eventData.name}`);
        return res.status(400).json({
          success: false,
          message: 'Event already exists or could not be imported'
        });
      }
      
      console.log(`Successfully imported event with ID: ${eventId}`);
      res.status(201).json({
        success: true,
        event: {
          id: eventId,
          name: eventData.name,
          status: 'pending'
        },
        message: 'Event imported successfully (pending approval)'
      });
    } catch (error) {
      console.error('Error importing external event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to import event'
      });
    }
  });
  
  // Mount the router on /api/external
  app.use('/external', router);
}