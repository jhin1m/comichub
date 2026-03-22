'use client';
import { Button } from '@/components/ui/button';

export function OAuthButton() {
  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <Button variant="secondary" className="w-full" onClick={handleGoogleLogin}>
      Continue with Google
    </Button>
  );
}
