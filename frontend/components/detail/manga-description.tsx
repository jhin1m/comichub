'use client';
import { useState, useRef, useEffect } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';

interface Props {
  description: string | null;
}

export function MangaDescription({ description }: Props) {
  const innerRef = useRef<HTMLParagraphElement>(null);
  const [clamped, setClamped] = useState(true);
  const [needsToggle, setNeedsToggle] = useState(false);

  // Compare inner text height vs the 3-line clamp height
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const check = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      setNeedsToggle(el.scrollHeight > lineHeight * 3 + 2);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [description]);

  if (!description) return null;

  return (
    <div className="space-y-1.5">
      <p
        ref={innerRef}
        className={`text-secondary text-sm leading-relaxed whitespace-pre-line transition-[max-height] duration-300 ease-in-out overflow-hidden ${
          clamped ? 'max-h-[4.5em]' : 'max-h-[80em]'
        }`}
      >
        {description}
      </p>

      {needsToggle && (
        <button
          onClick={() => setClamped((c) => !c)}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent/80 hover:text-accent transition-colors"
        >
          {clamped ? 'Show more' : 'Show less'}
          <CaretDownIcon
            size={12}
            weight="bold"
            className={`transition-transform duration-200 ${clamped ? '' : 'rotate-180'}`}
          />
        </button>
      )}
    </div>
  );
}
