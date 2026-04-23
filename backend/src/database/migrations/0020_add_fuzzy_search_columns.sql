-- Enable trigram + unaccent for fuzzy, diacritic-insensitive search
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint

-- IMMUTABLE wrapper so the function is usable in a GENERATED STORED expression.
-- Stock unaccent() is STABLE — cannot be referenced in a generated column.
CREATE OR REPLACE FUNCTION normalize_title(input text)
RETURNS text AS $$
  SELECT lower(unaccent('unaccent', coalesce(input, '')));
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;--> statement-breakpoint

-- jsonb flatten + normalize. Wrapped in a function because Postgres forbids
-- subquery expressions (ARRAY(SELECT …)) directly inside a generated column —
-- pushing the subquery into a function body sidesteps that restriction.
CREATE OR REPLACE FUNCTION normalize_alt_titles(alts jsonb)
RETURNS text AS $$
  SELECT normalize_title(
    array_to_string(
      ARRAY(SELECT jsonb_array_elements_text(coalesce(alts, '[]'::jsonb))),
      ' '
    )
  );
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;--> statement-breakpoint

ALTER TABLE "manga" ADD COLUMN "search_title" text
  GENERATED ALWAYS AS (normalize_title("title")) STORED;--> statement-breakpoint

ALTER TABLE "manga" ADD COLUMN "search_alt" text
  GENERATED ALWAYS AS (normalize_alt_titles("alt_titles")) STORED;
