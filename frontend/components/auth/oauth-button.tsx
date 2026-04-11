'use client';
import { Button } from '@/components/ui/button';
import { googleRedirectUrl } from '@/lib/api/auth.api';

export function OAuthButton() {
  const handleGoogleLogin = () => {
    window.location.href = googleRedirectUrl;
  };

  return (
    <Button variant="secondary" className="w-full" onClick={handleGoogleLogin}>
      Continue with Google
    </Button>
  );
}
