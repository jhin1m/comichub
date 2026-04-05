'use client';

import Image from 'next/image';
import { useState } from 'react';

interface Props {
  src: string;
  alt: string;
  /** CSS filter string from reader settings (e.g. "sepia(0.3) brightness(110%)"). */
  filterStyle?: string;
}

export function ReaderImage({ src, alt, filterStyle }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="w-full relative bg-base">
      <Image
        src={src}
        alt={alt}
        width={800}
        height={1200}
        className={`w-full h-auto transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={filterStyle && filterStyle !== 'none' ? { filter: filterStyle } : undefined}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        unoptimized
      />
    </div>
  );
}
