import Link from 'next/link';
import { formatCount } from '@/lib/utils';
import type { MangaDetail, TaxonomyItem } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

const STATUS_LABELS: Record<string, string> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  hiatus: 'Hiatus',
  dropped: 'Dropped',
};

const TYPE_LABELS: Record<string, string> = {
  manga: 'Manga',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
  doujinshi: 'Doujinshi',
};

function TaxonomyLinks({
  items,
  href,
}: {
  items: TaxonomyItem[];
  href: (item: TaxonomyItem) => string;
}) {
  if (!items.length) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-x-1">
      {items.map((item, i) => (
        <span key={item.id}>
          <Link
            href={href(item)}
            className="text-primary hover:text-accent transition-colors"
          >
            {item.name}
          </Link>
          {i < items.length - 1 && <span className="text-muted">,</span>}
        </span>
      ))}
    </span>
  );
}

function Row({ label, scrollable, children }: { label: string; scrollable?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2 border-b border-default last:border-0">
      <span className="text-muted shrink-0 font-rajdhani font-semibold w-20">{label}</span>
      <span className={`text-primary text-left flex-1 ${scrollable ? 'max-h-[3lh] overflow-y-auto' : ''}`}>
        {children}
      </span>
    </div>
  );
}

export function MangaMetadata({ manga }: Props) {
  const score = (Number(manga.averageRating) * 2).toFixed(1);

  return (
    <div className="text-sm">
      <Row label="Followed">
        <span className="font-rajdhani font-semibold">{formatCount(manga.followersCount)}</span> users
      </Row>
      <Row label="Score">
        <span className="font-rajdhani font-semibold">{score}</span> by {formatCount(manga.totalRatings)} users
      </Row>
      <Row label="Type">{TYPE_LABELS[manga.type] ?? manga.type}</Row>
      <Row label="Authors" scrollable>
        <TaxonomyLinks
          items={manga.authors}
          href={(a) => `/browse?author=${a.id}`}
        />
      </Row>
      <Row label="Artists" scrollable>
        <TaxonomyLinks
          items={manga.artists}
          href={(a) => `/browse?artist=${a.id}`}
        />
      </Row>
      <Row label="Genres" scrollable>
        <TaxonomyLinks
          items={manga.genres}
          href={(g) => `/browse?genre=${g.slug}`}
        />
      </Row>
      <Row label="Status">{STATUS_LABELS[manga.status] ?? manga.status}</Row>
    </div>
  );
}
