import Link from 'next/link';

const FOOTER_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/browse' },
  { label: 'About', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Privacy', href: '#' },
  { label: 'DMCA', href: '#' },
  { label: 'Contact', href: '#' },
];

export default function Footer() {
  return (
    <footer className="border-t border-default bg-base mt-auto">
      <div className="max-w-350 mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-4">
          <span className="font-rajdhani font-bold text-lg text-primary">
            Comic<span className="text-accent">Hub</span>
          </span>
          <nav className="flex items-center gap-5 flex-wrap justify-center">
            {FOOTER_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-xs text-muted hover:text-secondary transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} ComicHub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
