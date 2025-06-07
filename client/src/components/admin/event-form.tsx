import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiRequest } from '@/hooks/shared/useApiRequest';
import { useForm } from '@/hooks/shared/useForm';
import { BaseForm } from '@/components/ui/shared/BaseForm';
import { FormField } from '@/components/ui/shared/FormField';
import { FACILITY_TYPES, SKILL_LEVELS } from '@/lib/utils/constants';

interface EventFormProps {
  event?: any;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface EventFormData {
  name: string;
  description: string;
  sportType: string;
  facilityId: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  skillLevel: string;
  maxParticipants: string;
  isOfficial: boolean;
}

export function EventForm({ event, onCancel, onSuccess }: EventFormProps) {
  const isEdit = !!event;

  // Fetch facilities for dropdown
  const { data: facilities = [] } = useQuery({
    queryKey: ['/api/facilities'],
    queryFn: async () => {
      const response = await fetch('/api/facilities');
      return response.json();
    }
  });

  // Form validation
  const validate = (values: EventFormData): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!values.name.trim()) errors.name = 'Event name is required';
    if (!values.sportType) errors.sportType = 'Sport type is required';
    if (!values.eventDate) errors.eventDate = 'Event date is required';
    if (!values.startTime) errors.startTime = 'Start time is required';
    if (!values.endTime) errors.endTime = 'End time is required';
    if (!values.skillLevel) errors.skillLevel = 'Skill level is required';
    if (!values.maxParticipants || parseInt(values.maxParticipants) < 1) {
      errors.maxParticipants = 'Max participants must be at least 1';
    }
    
    return errors;
  };

  // API request hook
  const { execute: saveEvent } = useApiRequest({
    successMessage: `Event ${isEdit ? 'updated' : 'created'} successfully`,
    onSuccess: () => {
      onSuccess?.();
      onCancel();
    }
  });

  // Form management
  const { values, errors, isSubmitting, setValue, handleSubmit } = useForm<EventFormData>({
    initialValues: {
      name: event?.name || '',
      description: event?.description || '',
      sportType: event?.sportType || 'basketball',
      facilityId: event?.facilityId?.toString() || 'none',
      eventDate: event?.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : 
                  new Date().toISOString().split('T')[0],
      startTime: event?.startTime?.substring(0, 5) || '09:00',
      endTime: event?.endTime?.substring(0, 5) || '11:00',
      skillLevel: event?.skillLevel || 'beginner',
      maxParticipants: event?.maxParticipants?.toString() || '10',
      isOfficial: event?.isOfficial || false,
    },
    validate,
    onSubmit: async (formData) => {
      const payload = {
        ...formData,
        facilityId: formData.facilityId === 'none' ? null : parseInt(formData.facilityId),
        maxParticipants: parseInt(formData.maxParticipants),
        isOfficial: Boolean(formData.isOfficial),
      };

      const url = isEdit ? `/api/admin/events/${event!.id}` : '/api/admin/events';
      const method = isEdit ? 'PUT' : 'POST';
      
      await saveEvent(method, url, payload);
    }
  });

  const facilityOptions = [
    { value: 'none', label: 'None (External Location)' },
    ...facilities.map((facility: any) => ({
      value: facility.id.toString(),
      label: facility.name
    }))
  ];

  return (
    <BaseForm
      title={isEdit ? "Edit Event" : "Create New Event"}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
      submitText={isEdit ? "Update Event" : "Create Event"}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Event Name"
          name="name"
          value={values.name}
          onChange={(value) => setValue('name', value)}
          error={errors.name}
          placeholder="Enter event name"
          required
        />

        <FormField
          label="Sport Type"
          name="sportType"
          type="select"
          value={values.sportType}
          onChange={(value) => setValue('sportType', value)}
          error={errors.sportType}
          options={FACILITY_TYPES}
          required
        />

        <FormField
          label="Facility"
          name="facilityId"
          type="select"
          value={values.facilityId}
          onChange={(value) => setValue('facilityId', value)}
          options={facilityOptions}
        />

        <FormField
          label="Event Date"
          name="eventDate"
          type="date"
          value={values.eventDate}
          onChange={(value) => setValue('eventDate', value)}
          error={errors.eventDate}
          required
        />

        <FormField
          label="Start Time"
          name="startTime"
          type="time"
          value={values.startTime}
          onChange={(value) => setValue('startTime', value)}
          error={errors.startTime}
          required
        />

        <FormField
          label="End Time"
          name="endTime"
          type="time"
          value={values.endTime}
          onChange={(value) => setValue('endTime', value)}
          error={errors.endTime}
          required
        />

        <FormField
          label="Skill Level"
          name="skillLevel"
          type="select"
          value={values.skillLevel}
          onChange={(value) => setValue('skillLevel', value)}
          error={errors.skillLevel}
          options={SKILL_LEVELS}
          required
        />

        <FormField
          label="Max Participants"
          name="maxParticipants"
          type="number"
          value={values.maxParticipants}
          onChange={(value) => setValue('maxParticipants', value)}
          error={errors.maxParticipants}
          required
        />

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isOfficial"
            checked={values.isOfficial}
            onChange={(e) => setValue('isOfficial', e.target.checked)}
            className="rounded"
          />
          <label htmlFor="isOfficial">Official Event</label>
        </div>
      </div>

      <div className="md:col-span-2">
        <FormField
          label="Description"
          name="description"
          type="textarea"
          value={values.description}
          onChange={(value) => setValue('description', value)}
          placeholder="Enter event description"
        />
      </div>
    </BaseForm>
  );
}
