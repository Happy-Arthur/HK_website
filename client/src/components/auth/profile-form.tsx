import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { facilityTypes, districts } from "@shared/schema";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";

const profileFormSchema = z.object({
  fullName: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  phoneNumber: z.string().optional(),
  bio: z.string().optional(),
  preferredSports: z.array(z.string()).min(1, {
    message: "Please select at least one sport you're interested in.",
  }),
  skillLevel: z.record(z.string(), z.string()).optional(),
  preferredLocations: z.array(z.string()).min(1, {
    message: "Please select at least one preferred location.",
  }),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

const skillLevelOptions = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
  { label: "Expert", value: "expert" },
];

export default function ProfileForm({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: Partial<ProfileFormValues>;
  onSubmit: (values: ProfileFormValues) => void;
}) {
  const { toast } = useToast();
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: defaultValues || {
      fullName: "",
      email: "",
      phoneNumber: "",
      bio: "",
      preferredSports: [],
      skillLevel: {},
      preferredLocations: [],
    },
  });

  // Watch for changes to preferred sports to update skill levels section
  const watchPreferredSports = form.watch("preferredSports");
  
  useEffect(() => {
    setSelectedSports(watchPreferredSports || []);
  }, [watchPreferredSports]);
  
  // Helper to update the skill level for a specific sport
  const updateSkillLevel = (sport: string, level: string) => {
    const currentSkillLevels = form.getValues("skillLevel") || {};
    form.setValue("skillLevel", {
      ...currentSkillLevels,
      [sport]: level
    });
  };

  function handleSubmit(values: ProfileFormValues) {
    onSubmit(values);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Complete Your Profile</CardTitle>
        <CardDescription>
          Tell us about yourself so we can enhance your sports experience
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter your full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your.email@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+852 XXXX XXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="preferredSports"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Sports Interests</FormLabel>
                    <FormDescription>
                      Which sports are you interested in playing?
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {facilityTypes.map((item) => (
                      <FormField
                        key={item}
                        control={form.control}
                        name="preferredSports"
                        render={({ field }) => {
                          return (
                            <FormItem
                              key={item}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, item])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== item
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="capitalize">
                                {item}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Sport-specific skill levels */}
            {selectedSports.length > 0 && (
              <div className="space-y-4">
                <div className="mb-4">
                  <FormLabel className="text-base">Skill Levels</FormLabel>
                  <FormDescription>
                    Rate your skill level for each selected sport
                  </FormDescription>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedSports.map((sport) => (
                    <Card key={sport} className="p-4">
                      <CardTitle className="text-lg capitalize mb-2">{sport}</CardTitle>
                      <Select
                        onValueChange={(value) => updateSkillLevel(sport, value)}
                        defaultValue={form.getValues("skillLevel")?.[sport] || ""}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your skill level" />
                        </SelectTrigger>
                        <SelectContent>
                          {skillLevelOptions.map((option) => (
                            <SelectItem key={`${sport}-${option.value}`} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="preferredLocations"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">Preferred Locations</FormLabel>
                    <FormDescription>
                      Which districts in Hong Kong do you prefer to play in?
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {districts.map((district) => (
                      <FormField
                        key={district}
                        control={form.control}
                        name="preferredLocations"
                        render={({ field }) => {
                          // Convert snake_case to Title Case
                          const formattedDistrict = district
                            .split("_")
                            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(" ");
                          
                          return (
                            <FormItem
                              key={district}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(district)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, district])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== district
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {formattedDistrict}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us a bit about yourself and your sports experience..."
                      className="resize-none h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Share your sports background, interests, or what you're looking to achieve.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              Complete Profile
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}