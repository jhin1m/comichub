'use client';
import { Button } from '@/components/ui/button';

export function OAuthButton() {
  const handleGoogleLogin = () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth_state', state);
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
    window.location.href = `${baseUrl}/auth/google&state=${state}`;
  };

  return (
    <Button variant="secondary" className="w-full" onClick={handleGoogleLogin}>
      Continue with Google
    </Button>
  );
}
