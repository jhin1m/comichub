-- Migration: Add demographic column to manga table
ALTER TABLE "manga" ADD COLUMN "demographic" varchar(20);
