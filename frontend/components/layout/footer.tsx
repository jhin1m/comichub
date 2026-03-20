import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-[#2a2a2a] bg-[#0f0f0f] mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-rajdhani font-bold text-lg text-[#f5f5f5]">
            Comic<span className="text-[#e63946]">Hub</span>
          </span>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-xs text-[#5a5a5a] hover:text-[#a0a0a0] transition-colors">
              Home
            </Link>
            <Link href="/browse" className="text-xs text-[#5a5a5a] hover:text-[#a0a0a0] transition-colors">
              Browse
            </Link>
          </nav>
          <p className="text-xs text-[#5a5a5a]">
            &copy; {new Date().getFullYear()} ComicHub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
