import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { facilityTypes, districts } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { Facility } from "@shared/schema";

interface FacilityFormProps {
  facility?: Facility;
  onCancel: () => void;
}

export function FacilityForm({ facility, onCancel }: FacilityFormProps) {
  const { toast } = useToast();
  const isEdit = !!facility;
  
  // Format time string if it exists
  const formatTimeString = (timeStr: string | null | undefined) => {
    if (!timeStr) return "";
    // If already in HH:MM format, return as is
    if (timeStr.length === 5 && timeStr.includes(':')) return timeStr;
    // Try to get first 5 chars if longer
    return timeStr.substring(0, 5);
  };

  const [formData, setFormData] = useState({
    name: facility?.name || "",
    description: facility?.description || "",
    type: facility?.type || "basketball",
    district: facility?.district || "central",
    address: facility?.address || "",
    latitude: facility?.latitude !== undefined ? facility.latitude.toString() : "",
    longitude: facility?.longitude !== undefined ? facility.longitude.toString() : "",
    openTime: formatTimeString(facility?.openTime) || "07:00",
    closeTime: formatTimeString(facility?.closeTime) || "22:00",
    contactPhone: facility?.contactPhone || "",
    imageUrl: facility?.imageUrl || "",
    courts: facility?.courts !== undefined && facility.courts !== null ? facility.courts.toString() : "",
    amenities: facility?.amenities || [],
    ageRestriction: facility?.ageRestriction || "all_ages",
    genderSuitability: facility?.genderSuitability || "all_genders"
  });

  const createFacilityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(
        "POST", 
        "/api/admin/facilities", 
        {
          ...data,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          courts: data.courts ? parseInt(data.courts) : null,
        }
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Facility ${isEdit ? "updated" : "created"} successfully`,
      });
      // Invalidate both facility-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/facilities"] });
      // Force refetch
      queryClient.refetchQueries({ queryKey: ["/api/facilities"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/facilities"] });
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFacilityMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest(
        "PUT", 
        `/api/admin/facilities/${facility!.id}`, 
        {
          ...data,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          courts: data.courts ? parseInt(data.courts) : null,
        }
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Facility updated successfully",
      });
      // Invalidate both facility-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/facilities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/facilities"] });
      // Force refetch
      queryClient.refetchQueries({ queryKey: ["/api/facilities"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/facilities"] });
      onCancel();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      updateFacilityMutation.mutate(formData);
    } else {
      createFacilityMutation.mutate(formData);
    }
  };

  const isPending = createFacilityMutation.isPending || updateFacilityMutation.isPending;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Facility" : "Create New Facility"}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Facility Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Enter facility name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Facility Type *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => handleSelectChange("type", value)}
                required
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {facilityTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="district">District *</Label>
              <Select 
                value={formData.district} 
                onValueChange={(value) => handleSelectChange("district", value)}
                required
              >
                <SelectTrigger id="district">
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="Enter facility address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude *</Label>
              <Input
                id="latitude"
                name="latitude"
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={handleChange}
                required
                placeholder="e.g. 22.3193"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude *</Label>
              <Input
                id="longitude"
                name="longitude"
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={handleChange}
                required
                placeholder="e.g. 114.1694"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="courts">Number of Courts</Label>
              <Input
                id="courts"
                name="courts"
                type="number"
                value={formData.courts}
                onChange={handleChange}
                placeholder="Enter number of courts"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="openTime">Opening Time</Label>
              <Input
                id="openTime"
                name="openTime"
                type="time"
                value={formData.openTime}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="closeTime">Closing Time</Label>
              <Input
                id="closeTime"
                name="closeTime"
                type="time"
                value={formData.closeTime}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                placeholder="e.g. +852 1234 5678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                name="imageUrl"
                value={formData.imageUrl}
                onChange={handleChange}
                placeholder="Enter image URL"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter facility description"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Update Facility" : "Create Facility"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}