import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Initialize headers with content type if data is provided
  const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
  
  // Check for and add authentication token from localStorage
  const storedToken = localStorage.getItem('auth_token');
  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
    console.log("Added auth token from localStorage to request headers");
  }
  
  // Create options object with appropriate credentials
  const options: RequestInit = {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // This is critical for sending cookies
  };

  console.log(
    `Making ${method} request to ${url}${data ? " with data:" : ""}`,
    data,
  );

  try {
    const res = await fetch(url, options);

    // Detailed logging for debugging
    if (!res.ok) {
      const contentType = res.headers.get("content-type");
      let errorDetails;

      if (contentType && contentType.includes("application/json")) {
        errorDetails = await res.json();
        console.error(`API error (${res.status}) from ${url}:`, errorDetails);
      } else {
        errorDetails = await res.text();
        console.error(`API error (${res.status}) from ${url}: ${errorDetails}`);
      }

      // Special handling for authentication errors
      if (res.status === 401) {
        console.warn(
          "Authentication error detected. Current auth state may be invalid.",
        );

        // You could trigger a logout or authentication refresh here
      }

      throw new Error(
        `${res.status}: ${
          typeof errorDetails === "string"
            ? errorDetails
            : JSON.stringify(errorDetails)
        }`,
      );
    }

    return res;
  } catch (error) {
    console.error(`Request to ${url} failed:`, error);
    throw error;
  }
}

// Build a URL with query parameters
export function buildUrl(
  baseUrl: string,
  params?: Record<string, any>,
): string {
  if (!params) return baseUrl;

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value.toString());
    }
  });

  const queryString = searchParams.toString();
  if (!queryString) return baseUrl;

  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${queryString}`;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Extract the base URL and any params object
    const baseUrl = queryKey[0] as string;
    const params = queryKey[1] as Record<string, any> | undefined;

    // Build the full URL with any params
    const url = buildUrl(baseUrl, params);

    console.log(`Making query request to: ${url}`);

    try {
      // Initialize headers
      const headers: HeadersInit = {};
      
      // Check for and add authentication token from localStorage
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
        console.log("Added auth token from localStorage to query headers");
      }
      
      const res = await fetch(url, {
        credentials: "include", // Ensure cookies are sent
        headers
      });

      if (res.status === 401) {
        console.warn(`Authentication error in query to ${url}`);

        if (unauthorizedBehavior === "returnNull") {
          return null;
        }

        // Get error details for better logging
        try {
          const errorDetails = await res.json();
          throw new Error(
            `Authentication error: ${JSON.stringify(errorDetails)}`,
          );
        } catch (e) {
          throw new Error(`Authentication error: ${res.statusText}`);
        }
      }

      if (!res.ok) {
        const text = await res.text();
        console.error(`Query error (${res.status}) from ${url}: ${text}`);
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }

      const data = await res.json();
      return data;
    } catch (error) {
      console.error(`Query to ${url} failed:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
