'use client';

import { AuthProvider } from '@/contexts/auth.context';
import { PreferencesProvider } from '@/contexts/preferences.context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PreferencesProvider>{children}</PreferencesProvider>
    </AuthProvider>
  );
}
