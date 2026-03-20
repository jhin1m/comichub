'use client';
import { PixelButton } from '@pxlkit/ui-kit';

export function OAuthButton() {
  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <PixelButton tone="neutral" className="w-full" onClick={handleGoogleLogin}>
      Continue with Google
    </PixelButton>
  );
}
