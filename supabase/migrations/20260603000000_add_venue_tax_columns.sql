-- Migration to add CGST, SGST, and Service Tax percentages to venues table
ALTER TABLE venues 
  ADD COLUMN IF NOT EXISTS cgst_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_tax_pct numeric DEFAULT 0;
