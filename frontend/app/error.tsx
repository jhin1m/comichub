'use client';

import { Button } from '@/components/ui/button';
import PageWrapper from '@/components/layout/page-wrapper';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ reset }: ErrorProps) {
  return (
    <PageWrapper className="py-24 flex flex-col items-center text-center">
      <h1 className="font-rajdhani font-bold text-5xl text-primary mb-4">
        Something went wrong
      </h1>
      <p className="text-secondary text-lg mb-8">
        An unexpected error occurred. Please try again.
      </p>
      <Button variant="primary" onClick={reset}>
        Try Again
      </Button>
    </PageWrapper>
  );
}
