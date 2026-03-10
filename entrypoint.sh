#!/bin/sh
set -e

echo "Running pre-schema fixes..."
# Drop the stale notifications table only if it exists with the OLD schema
# (missing the 'userId' column). On subsequent restarts this is a no-op.
npx prisma db execute --stdin << 'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications'
      AND column_name = 'userId'
  ) THEN
    DROP TABLE notifications CASCADE;
    RAISE NOTICE 'Dropped stale notifications table (old schema)';
  END IF;
END $$;
SQL

echo "Syncing database schema..."
npx prisma db push --accept-data-loss

echo "Starting application..."
exec node dist/src/main.js
