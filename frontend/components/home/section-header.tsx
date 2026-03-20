import Link from 'next/link';

interface SectionHeaderProps {
  title: string;
  href?: string;
}

export function SectionHeader({ title, href }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-rajdhani font-bold text-xl md:text-2xl text-[#f5f5f5]">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-sm text-[#e63946] hover:text-[#c1121f] transition-colors"
        >
          See all
        </Link>
      )}
    </div>
  );
}
