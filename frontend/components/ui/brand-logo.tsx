import { SITE_NAME, SITE_LOGO } from '@/lib/seo';

interface BrandLogoProps {
  size?: 'sm' | 'md';
}

/** Brand logo — renders image if NEXT_PUBLIC_SITE_LOGO is set, text-only otherwise */
function BrandLogo({ size = 'md' }: BrandLogoProps) {
  const h = size === 'sm' ? 20 : 28;

  if (SITE_LOGO) {
    /* eslint-disable @next/next/no-img-element -- supports both local and external URLs without remote pattern config */
    return <img src={SITE_LOGO} alt={SITE_NAME} height={h} className="object-contain" />;
  }

  return (
    <span className={`font-rajdhani font-bold text-primary ${size === 'sm' ? 'text-base' : 'text-xl'}`}>
      {SITE_NAME}
    </span>
  );
}

export { BrandLogo };
