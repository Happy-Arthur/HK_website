import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, MapPin, Calendar } from 'lucide-react';
import { FACILITY_TYPES, DISTRICTS, SKILL_LEVELS, getLabelFromValue, formatDate } from '@/lib/constants';

interface PendingItemsProps {
  onApprovalUpdate?: () => void;
}

export function PendingItems({ onApprovalUpdate }: PendingItemsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('facilities');
  
  // Fetch pending facilities
  const { data: pendingFacilities, isLoading: isLoadingFacilities } = useQuery({
    queryKey: ['/api/admin/pending/facilities'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/pending/facilities');
      return response.json();
    }
  });
  
  // Fetch pending events
  const { data: pendingEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/admin/pending/events'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/pending/events');
      return response.json();
    }
  });
  
  // Approve facility mutation
  const approveFacilityMutation = useMutation({
    mutationFn: async (facilityId: number) => {
      const response = await apiRequest('POST', `/api/admin/facilities/${facilityId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Facility approved successfully',
        variant: 'default',
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending/facilities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/facilities'] });
      if (onApprovalUpdate) {
        onApprovalUpdate();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Approval Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Reject facility mutation
  const rejectFacilityMutation = useMutation({
    mutationFn: async (facilityId: number) => {
      const response = await apiRequest('POST', `/api/admin/facilities/${facilityId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Facility rejected',
        variant: 'default',
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending/facilities'] });
      if (onApprovalUpdate) {
        onApprovalUpdate();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Rejection Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Approve event mutation
  const approveEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest('POST', `/api/admin/events/${eventId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Event approved successfully',
        variant: 'default',
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      if (onApprovalUpdate) {
        onApprovalUpdate();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Approval Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Reject event mutation
  const rejectEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest('POST', `/api/admin/events/${eventId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Event rejected',
        variant: 'default',
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending/events'] });
      if (onApprovalUpdate) {
        onApprovalUpdate();
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Rejection Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Handle facility approval
  const handleApproveFacility = (facilityId: number) => {
    approveFacilityMutation.mutate(facilityId);
  };
  
  // Handle facility rejection
  const handleRejectFacility = (facilityId: number) => {
    rejectFacilityMutation.mutate(facilityId);
  };
  
  // Handle event approval
  const handleApproveEvent = (eventId: number) => {
    approveEventMutation.mutate(eventId);
  };
  
  // Handle event rejection
  const handleRejectEvent = (eventId: number) => {
    rejectEventMutation.mutate(eventId);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Pending Approvals</h2>
      </div>
      
      <Tabs 
        defaultValue="facilities" 
        value={tab} 
        onValueChange={setTab}
        className="w-full"
      >
        <TabsList className="w-full mb-4">
          <TabsTrigger value="facilities" className="flex-1">
            <MapPin className="mr-2 h-4 w-4" />
            Facilities
            {pendingFacilities && pendingFacilities.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingFacilities.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-1">
            <Calendar className="mr-2 h-4 w-4" />
            Events
            {pendingEvents && pendingEvents.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingEvents.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        {/* Facilities Tab Content */}
        <TabsContent value="facilities">
          {isLoadingFacilities ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !pendingFacilities || pendingFacilities.length === 0 ? (
            <Alert>
              <AlertDescription>
                No facilities pending approval.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingFacilities.map((facility) => (
                <Card key={facility.id} className="overflow-hidden">
                  {facility.imageUrl && (
                    <div className="h-40 overflow-hidden">
                      <img 
                        src={facility.imageUrl} 
                        alt={facility.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle>{facility.name}</CardTitle>
                    <CardDescription>
                      Source: {facility.searchSource || 'Unknown'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {getLabelFromValue(facility.type, FACILITY_TYPES)}
                      </Badge>
                      <Badge variant="outline">
                        {getLabelFromValue(facility.district, DISTRICTS)}
                      </Badge>
                    </div>
                    
                    <div className="text-sm">
                      <div className="font-medium">Address:</div>
                      <div>{facility.address}</div>
                    </div>
                    
                    {facility.description && (
                      <div className="text-sm">
                        <div className="font-medium">Description:</div>
                        <div>{facility.description}</div>
                      </div>
                    )}
                    
                    {facility.openTime && facility.closeTime && (
                      <div className="text-sm">
                        <div className="font-medium">Hours:</div>
                        <div>{facility.openTime} - {facility.closeTime}</div>
                      </div>
                    )}
                  </CardContent>
                  <Separator />
                  <CardFooter className="flex justify-end gap-2 p-4">
                    <Button
                      variant="destructive"
                      onClick={() => handleRejectFacility(facility.id)}
                      disabled={rejectFacilityMutation.isPending}
                    >
                      {rejectFacilityMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleApproveFacility(facility.id)}
                      disabled={approveFacilityMutation.isPending}
                    >
                      {approveFacilityMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Events Tab Content */}
        <TabsContent value="events">
          {isLoadingEvents ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !pendingEvents || pendingEvents.length === 0 ? (
            <Alert>
              <AlertDescription>
                No events pending approval.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingEvents.map((event) => (
                <Card key={event.id}>
                  <CardHeader>
                    <CardTitle>{event.name}</CardTitle>
                    <CardDescription>
                      Source: {event.searchSource || 'Unknown'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {getLabelFromValue(event.sportType, FACILITY_TYPES)}
                      </Badge>
                      {event.skillLevel && (
                        <Badge variant="outline">
                          {getLabelFromValue(event.skillLevel, SKILL_LEVELS)}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-sm">
                      <div className="font-medium">Date & Time:</div>
                      <div>{formatDate(event.eventDate)} | {event.startTime} - {event.endTime}</div>
                    </div>
                    
                    {event.description && (
                      <div className="text-sm">
                        <div className="font-medium">Description:</div>
                        <div>{event.description}</div>
                      </div>
                    )}
                    
                    {event.locationName && (
                      <div className="text-sm">
                        <div className="font-medium">Location:</div>
                        <div>{event.locationName}</div>
                        {event.locationAddress && <div>{event.locationAddress}</div>}
                      </div>
                    )}
                    
                    {event.contactInfo && (
                      <div className="text-sm">
                        <div className="font-medium">Contact:</div>
                        <div>{event.contactInfo}</div>
                      </div>
                    )}
                  </CardContent>
                  <Separator />
                  <CardFooter className="flex justify-end gap-2 p-4">
                    <Button
                      variant="destructive"
                      onClick={() => handleRejectEvent(event.id)}
                      disabled={rejectEventMutation.isPending}
                    >
                      {rejectEventMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleApproveEvent(event.id)}
                      disabled={approveEventMutation.isPending}
                    >
                      {approveEventMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}