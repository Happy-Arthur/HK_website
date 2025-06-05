import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const API_SOURCES = [
  {
    id: "google_maps",
    name: "Google Maps",
    description: "For location data, geocoding, and directions",
    placeholder: "AIza..."
  },
  {
    id: "hk_government",
    name: "Hong Kong Government Data API",
    description: "For official facility and event data from HK government",
    placeholder: "hkg_..."
  },
  {
    id: "open_weather",
    name: "OpenWeather API",
    description: "For weather data and forecasts",
    placeholder: "Your OpenWeather API key"
  },
  {
    id: "foursquare",
    name: "Foursquare Places API",
    description: "For place search and recommendations",
    placeholder: "fsq_..."
  }
];

export function ApiIntegrationForm() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    google_maps: "",
    hk_government: "",
    open_weather: "",
    foursquare: ""
  });

  const [savedKeys, setSavedKeys] = useState<string[]>([]);

  const saveApiKeyMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string, value: string }) => {
      const res = await apiRequest(
        "POST", 
        "/api/admin/settings/api-keys", 
        { key, value }
      );
      return await res.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "API Key Saved",
        description: `Successfully saved the ${variables.key.replace('_', ' ')} API key.`,
      });
      setSavedKeys(prev => [...prev, variables.key]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testApiKeyMutation = useMutation({
    mutationFn: async ({ key }: { key: string }) => {
      const res = await apiRequest(
        "POST", 
        `/api/admin/settings/test-api-key`, 
        { key }
      );
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Test Successful" : "Test Failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApiKeyChange = (key: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveApiKey = (key: string) => {
    if (!apiKeys[key]) {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive",
      });
      return;
    }
    
    saveApiKeyMutation.mutate({ key, value: apiKeys[key] });
  };

  const handleTestApiKey = (key: string) => {
    if (!savedKeys.includes(key)) {
      toast({
        title: "Warning",
        description: "Please save the API key before testing",
        variant: "destructive",
      });
      return;
    }
    
    testApiKeyMutation.mutate({ key });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>API Integrations</CardTitle>
        <CardDescription>
          Add API keys to enable external data sources for the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-amber-50 border-amber-200">
          <AlertTitle>Important Information</AlertTitle>
          <AlertDescription>
            API keys added here will be securely stored and used to fetch data from external services.
            You will need admin privileges to manage these keys. Make sure to keep your API keys confidential.
          </AlertDescription>
        </Alert>

        {API_SOURCES.map((source) => (
          <div key={source.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium flex items-center">
                  {source.name}
                  {savedKeys.includes(source.id) && (
                    <CheckCircle2 className="h-4 w-4 ml-2 text-green-500" />
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">{source.description}</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor={source.id} className="sr-only">
                  {source.name} API Key
                </Label>
                <Input
                  id={source.id}
                  type="password"
                  placeholder={source.placeholder}
                  value={apiKeys[source.id]}
                  onChange={(e) => handleApiKeyChange(source.id, e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSaveApiKey(source.id)}
                  disabled={saveApiKeyMutation.isPending && saveApiKeyMutation.variables?.key === source.id}
                >
                  {saveApiKeyMutation.isPending && saveApiKeyMutation.variables?.key === source.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleTestApiKey(source.id)}
                  disabled={
                    !savedKeys.includes(source.id) || 
                    testApiKeyMutation.isPending
                  }
                >
                  {testApiKeyMutation.isPending && testApiKeyMutation.variables?.key === source.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Test
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-end">
        <p className="text-sm text-muted-foreground">
          API keys are securely stored and never exposed in client-side code
        </p>
      </CardFooter>
    </Card>
  );
}