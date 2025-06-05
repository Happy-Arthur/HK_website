export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  headers?: Record<string, string>;
}

export async function apiRequest<T = any>(
  url: string,
  options: ApiRequestOptions
): Promise<T> {
  const { method, data, headers = {} } = options;

  const requestOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Include cookies for authentication
  };

  if (data !== undefined) {
    requestOptions.body = JSON.stringify(data);
  }

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Request failed with status ${response.status}`,
    }));
    throw new Error(errorData.message || `Request failed with status ${response.status}`);
  }

  // Handle empty responses (like DELETE operations that return 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}