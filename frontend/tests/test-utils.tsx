import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { apiClient } from '@/lib/api-client';
import { AuthProvider } from '@/contexts/auth.context';
import { PreferencesProvider } from '@/contexts/preferences.context';

// Fresh SWR cache per render call so cached data from one test never leaks
// into the next. Also disables dedupe so back-to-back fetches in a single
// test re-fire the network handler instead of returning the previous result.
function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        fetcher: (url: string) => apiClient.get(url).then((r) => r.data),
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
      }}
    >
      <AuthProvider>
        <PreferencesProvider>
          {children}
        </PreferencesProvider>
      </AuthProvider>
    </SWRConfig>
  );
}

function customRender(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
