-- Add 'comix' to import_source enum for comix.to imports
ALTER TYPE "import_source" ADD VALUE IF NOT EXISTS 'comix';
