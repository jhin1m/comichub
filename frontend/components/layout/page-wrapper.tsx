import { cn } from '@/lib/utils';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <main className={cn('max-w-[1400px] mx-auto px-4', className)}>
      {children}
    </main>
  );
}
