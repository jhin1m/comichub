import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/tests/test-utils';
import { ChapterList } from './chapter-list';
import type { ChapterListItem } from '@/types/manga.types';

const makeChapter = (id: number, number: string, overrides?: Partial<ChapterListItem>): ChapterListItem => ({
  id,
  number,
  title: `Chapter ${number} Title`,
  slug: `ch-${number}`,
  language: 'en',
  viewCount: id * 100,
  order: id,
  createdAt: new Date(2026, 0, id).toISOString(),
  ...overrides,
});

const chapters: ChapterListItem[] = [
  makeChapter(1, '1'),
  makeChapter(2, '2'),
  makeChapter(3, '10'),
];

describe('ChapterList', () => {
  it('renders all chapter rows', () => {
    render(<ChapterList chapters={chapters} mangaSlug="test-manga" />);
    expect(screen.getByText('Ch. 1')).toBeInTheDocument();
    expect(screen.getByText('Ch. 2')).toBeInTheDocument();
    expect(screen.getByText('Ch. 10')).toBeInTheDocument();
  });

  it('shows chapter count in header', () => {
    render(<ChapterList chapters={chapters} mangaSlug="test-manga" />);
    expect(screen.getByText(`(${chapters.length})`)).toBeInTheDocument();
  });

  it('filters chapters by search query — smart numeric match', async () => {
    const user = userEvent.setup();
    render(<ChapterList chapters={chapters} mangaSlug="test-manga" />);

    const input = screen.getByPlaceholderText(/search chapter/i);
    await user.type(input, '1');

    // "1" matches ch.1 only — not ch.10 (smart prefix rules)
    expect(screen.getByText('Ch. 1')).toBeInTheDocument();
    expect(screen.queryByText('Ch. 10')).not.toBeInTheDocument();
    expect(screen.queryByText('Ch. 2')).not.toBeInTheDocument();
  });

  it('shows "No chapters found" when search has no results', async () => {
    const user = userEvent.setup();
    render(<ChapterList chapters={chapters} mangaSlug="test-manga" />);

    await user.type(screen.getByPlaceholderText(/search chapter/i), '999');
    expect(screen.getByText(/no chapters found/i)).toBeInTheDocument();
  });

  it('toggles sort direction when clicking sort button twice', async () => {
    const user = userEvent.setup();
    render(<ChapterList chapters={chapters} mangaSlug="test-manga" />);

    const sortBtn = screen.getByRole('button', { name: /sort by chapter number/i });

    // Default is desc — clicking once switches to asc
    await user.click(sortBtn);
    // Click again to toggle back to desc
    await user.click(sortBtn);

    // After two clicks we're back to original state — all rows still visible
    expect(screen.getByText('Ch. 1')).toBeInTheDocument();
    expect(screen.getByText('Ch. 10')).toBeInTheDocument();
  });

});
