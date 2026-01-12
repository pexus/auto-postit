const API_BASE = '';

class ApiClient {
  private async request<T>(
    method: string,
    path: string,
    data?: unknown
  ): Promise<{ data: T }> {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
      throw new Error(error.error?.message || 'Request failed');
    }

    const responseData = await response.json();
    return { data: responseData };
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, data?: unknown) {
    return this.request<T>('POST', path, data);
  }

  put<T>(path: string, data?: unknown) {
    return this.request<T>('PUT', path, data);
  }

  delete<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

export const api = new ApiClient();
