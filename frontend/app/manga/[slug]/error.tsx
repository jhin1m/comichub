'use client';

import { Button } from '@/components/ui/button';
import PageWrapper from '@/components/layout/page-wrapper';

export default function MangaError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageWrapper className="py-24 flex flex-col items-center text-center">
      <h1 className="font-rajdhani font-bold text-3xl text-primary mb-4">
        Failed to load manga
      </h1>
      <p className="text-secondary mb-8">
        This manga may not exist or there was a server error.
      </p>
      <Button variant="primary" onClick={reset}>
        Try Again
      </Button>
    </PageWrapper>
  );
}
