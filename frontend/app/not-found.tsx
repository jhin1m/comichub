import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PageWrapper from '@/components/layout/page-wrapper';

export default function NotFound() {
  return (
    <PageWrapper className="py-24 flex flex-col items-center text-center">
      <h1 className="font-rajdhani font-bold text-5xl text-primary mb-4">
        Manga Not Found
      </h1>
      <p className="text-secondary text-lg mb-8">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/">
        <Button variant="primary">Back to Home</Button>
      </Link>
    </PageWrapper>
  );
}
