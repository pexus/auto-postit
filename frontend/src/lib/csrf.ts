let cachedToken: string | null = null;
let inflight: Promise<string> | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  if (inflight) {
    return inflight;
  }

  inflight = fetch('/auth/csrf', {
    method: 'GET',
    credentials: 'include',
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      const data = await response.json();
      cachedToken = data.csrfToken as string;
      return cachedToken;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function clearCsrfToken(): void {
  cachedToken = null;
}
