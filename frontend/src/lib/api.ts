const API_BASE = '';

interface RequestConfig {
  params?: Record<string, string | undefined>;
  headers?: Record<string, string>;
}

class ApiClient {
  private buildUrl(path: string, params?: Record<string, string | undefined>): string {
    const url = new URL(`${API_BASE}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value);
        }
      });
    }
    return url.pathname + url.search;
  }

  private async request<T>(
    method: string,
    path: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<{ data: T }> {
    const url = this.buildUrl(path, config?.params);
    
    const headers: Record<string, string> = {
      ...config?.headers,
    };
    
    // Only set Content-Type for non-FormData
    if (!(data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: data 
        ? data instanceof FormData 
          ? data 
          : JSON.stringify(data) 
        : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(error.error?.message || 'Request failed');
    }

    const responseData = await response.json();
    return { data: responseData };
  }

  get<T>(path: string, config?: RequestConfig) {
    return this.request<T>('GET', path, undefined, config);
  }

  post<T>(path: string, data?: unknown, config?: RequestConfig) {
    return this.request<T>('POST', path, data, config);
  }

  put<T>(path: string, data?: unknown, config?: RequestConfig) {
    return this.request<T>('PUT', path, data, config);
  }

  delete<T>(path: string, config?: RequestConfig) {
    return this.request<T>('DELETE', path, undefined, config);
  }
}

export const api = new ApiClient();
