import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, ShieldCheck, ShieldX } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type EmailFormValues = z.infer<typeof emailSchema>;

export function AdminSetup() {
  const { toast } = useToast();
  const [setupComplete, setSetupComplete] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/admin/setup", { email });
      return await res.json();
    },
    onSuccess: (data) => {
      setAdminEmail(data.user.email);
      setSetupComplete(true);
      toast({
        title: "Admin setup complete",
        description: `User ${data.user.email} has been granted admin privileges`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Admin setup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: EmailFormValues) => {
    setupMutation.mutate(values.email);
  };

  return (
    <div className="container max-w-md mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Admin Setup</CardTitle>
          <CardDescription>
            Set up the initial admin user for your sports facility platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {setupComplete ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="mb-4 p-3 rounded-full bg-green-100">
                <ShieldCheck className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Admin Setup Complete</h3>
              <p className="text-muted-foreground mb-4">
                User <span className="font-medium">{adminEmail}</span> has been granted admin privileges.
              </p>
              <div className="flex flex-col gap-2 text-sm text-left w-full p-4 bg-gray-50 rounded-md">
                <p>This user can now:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Access the admin dashboard</li>
                  <li>Manage users and grant admin privileges</li>
                  <li>Import external facilities and events</li>
                  <li>Manage system settings</li>
                </ul>
              </div>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex justify-center mb-6">
                  <div className="p-3 rounded-full bg-blue-100">
                    <Shield className="h-12 w-12 text-blue-600" />
                  </div>
                </div>
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="text-sm text-muted-foreground p-3 bg-gray-50 rounded-md">
                  <p className="mb-2 font-medium">Important:</p>
                  <p>This email address must belong to a registered user in the system. The user will be granted administrative privileges.</p>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={setupMutation.isPending}
                >
                  {setupMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    "Grant Admin Privileges"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          {setupComplete && (
            <Button variant="outline" onClick={() => window.location.href = "/admin"}>
              Go to Admin Dashboard
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}