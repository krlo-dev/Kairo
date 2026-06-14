#!/usr/bin/env bash
# Backup MySQL semanal externo — Kairo
# Se completa en Fase 9. Por defecto Hostinger ya hace daily backup.

set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUT_DIR="${KAIRO_BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"

mysqldump \
  --host="${DB_HOST:?DB_HOST required}" \
  --user="${DB_USER:?DB_USER required}" \
  --password="${DB_PASSWORD:?DB_PASSWORD required}" \
  --single-transaction \
  --quick \
  --triggers \
  --routines \
  "${DB_NAME:-kairo}" \
  | gzip > "$OUT_DIR/kairo_${TIMESTAMP}.sql.gz"

echo "✓ Backup: $OUT_DIR/kairo_${TIMESTAMP}.sql.gz"

# TODO: upload a S3/Backblaze (Fase 9)
