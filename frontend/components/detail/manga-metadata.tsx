import Link from 'next/link';
import type { MangaDetail, TaxonomyItem } from '@/types/manga.types';

interface Props {
  manga: MangaDetail;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
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
  if (!items.length) return <span className="text-[#707070]">—</span>;
  return (
    <span className="flex flex-wrap gap-x-1">
      {items.map((item, i) => (
        <span key={item.id}>
          <Link
            href={href(item)}
            className="text-[#f5f5f5] hover:text-[#a0a0a0] transition-colors"
          >
            {item.name}
          </Link>
          {i < items.length - 1 && <span className="text-[#707070]">,</span>}
        </span>
      ))}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-1.5 border-b border-[#2a2a2a] last:border-0">
      <span className="text-[#707070] shrink-0">{label}</span>
      <span className="text-[#f5f5f5] text-left">{children}</span>
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
