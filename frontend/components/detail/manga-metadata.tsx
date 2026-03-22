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
            className="text-primary hover:text-secondary transition-colors"
          >
            {item.name}
          </Link>
          {i < items.length - 1 && <span className="text-muted">,</span>}
        </span>
      ))}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5 border-b border-default last:border-0">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-primary text-left">{children}</span>
    </div>
  );
}

export function MangaMetadata({ manga }: Props) {
  const score = (Number(manga.averageRating) * 2).toFixed(1);

  return (
    <div className="text-sm">
      <Row label="Followed">
        {formatCount(manga.followersCount)} users
      </Row>
      <Row label="Score">
        {score} by {formatCount(manga.totalRatings)} users
      </Row>
      <Row label="Type">{TYPE_LABELS[manga.type] ?? manga.type}</Row>
      <Row label="Authors">
        <TaxonomyLinks
          items={manga.authors}
          href={(a) => `/author/${a.slug}`}
        />
      </Row>
      <Row label="Artists">
        <TaxonomyLinks
          items={manga.artists}
          href={(a) => `/artist/${a.slug}`}
        />
      </Row>
      <Row label="Genres">
        <TaxonomyLinks
          items={manga.genres}
          href={(g) => `/browse?genre=${g.slug}`}
        />
      </Row>
      <Row label="Status">{STATUS_LABELS[manga.status] ?? manga.status}</Row>
    </div>
  );
}
