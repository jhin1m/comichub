'use client';
import Image from 'next/image';
import { useState } from 'react';

interface Props {
  src: string;
  alt: string;
}

export function ReaderImage({ src, alt }: Props) {
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
        onLoad={() => setLoaded(true)}
        loading="lazy"
        unoptimized
      />
    </div>
  );
}
