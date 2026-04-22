'use client';

import { AuthProvider } from '@/contexts/auth.context';
import { PreferencesProvider } from '@/contexts/preferences.context';
import { SWRProvider } from '@/lib/swr/swr-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SWRProvider>
        <PreferencesProvider>{children}</PreferencesProvider>
      </SWRProvider>
    </AuthProvider>
  );
}
