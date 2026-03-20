'use client';

import { PixelButton } from '@pxlkit/ui-kit';
import PageWrapper from '@/components/layout/page-wrapper';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ reset }: ErrorProps) {
  return (
    <PageWrapper className="py-24 flex flex-col items-center text-center">
      <h1 className="font-rajdhani font-bold text-5xl text-[#f5f5f5] mb-4">
        Something went wrong
      </h1>
      <p className="text-[#a0a0a0] text-lg mb-8">
        An unexpected error occurred. Please try again.
      </p>
      <PixelButton tone="red" onClick={reset}>
        Try Again
      </PixelButton>
    </PageWrapper>
  );
}
