'use client';
import { useState } from 'react';

interface Props {
  description: string | null;
}

export function MangaDescription({ description }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!description) return null;

  return (
    <div className="space-y-2">
      <p
        className={`text-secondary text-sm leading-relaxed whitespace-pre-line ${
          expanded ? '' : 'line-clamp-4'
        }`}
      >
        {description}
      </p>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="text-xs text-secondary hover:text-primary transition-colors"
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}
