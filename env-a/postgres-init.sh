#!/bin/sh
set -e

# Create the auth and todo databases in the shared Postgres instance.
# POSTGRES_DB may create authdb automatically on first startup, but we also ensure both databases exist.
if [ "$(psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='authdb';")" != '1' ]; then
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE authdb;"
fi

if [ "$(psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='tododb';")" != '1' ]; then
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE tododb;"
fi
