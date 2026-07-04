#!/usr/bin/env bash
#
# pg_dump the rssreader database to /var/backups/rssreader/, rotate old files,
# and optionally push to an off-machine destination via a user-provided command.
#
# Environment:
#   DATABASE_URL     Postgres connection string (defaults to reading the
#                    backend/.env DATABASE_URL if present)
#   BACKUP_DIR       Local backup directory (default /var/backups/rssreader)
#   BACKUP_RETAIN    Number of daily backups to retain locally (default 14)
#   BACKUP_OFFSITE   Shell command run on each new dump; receives the file path
#                    on stdin. Example:
#                      export BACKUP_OFFSITE='xargs -I{} rclone copy {} remote:rssreader-backups/'
#                    Leave unset to skip the off-machine step.
#
# Intended to be run under a systemd timer — see scripts/pg-backup.{service,timer}.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/rssreader}"
BACKUP_RETAIN="${BACKUP_RETAIN:-14}"

if [ -z "${DATABASE_URL:-}" ]; then
  # Read from the deployed backend .env if not passed in.
  ENV_FILE="/home/secorp/src/rssreader/backend/.env"
  if [ -f "$ENV_FILE" ]; then
    DATABASE_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set (checked env and backend/.env)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/rssreader-$timestamp.sql.gz"

pg_dump --format=plain --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$out"
chmod 600 "$out"

# Rotate: keep the newest $BACKUP_RETAIN files, delete the rest.
ls -1t "$BACKUP_DIR"/rssreader-*.sql.gz 2>/dev/null | tail -n +$((BACKUP_RETAIN + 1)) | xargs -r rm -f

if [ -n "${BACKUP_OFFSITE:-}" ]; then
  echo "$out" | bash -c "$BACKUP_OFFSITE"
fi

echo "backup complete: $out"
