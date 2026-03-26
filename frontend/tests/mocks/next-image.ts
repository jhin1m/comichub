import { vi } from 'vitest';
import React from 'react';

vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => {
    const { fill, priority, ...safeProps } = rest;
    return React.createElement('img', { src, alt, ...safeProps });
  },
}));
