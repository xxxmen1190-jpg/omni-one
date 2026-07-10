#!/bin/bash

# Omni One Database Backup Script
# Can be run via cron on the host machine: 
# 0 2 * * * /opt/omni-one/scripts/backup-db.sh >> /var/log/omni-backup.log 2>&1

set -e

# Configuration
BACKUP_DIR="/opt/omni-one/backups"
DB_CONTAINER="omni_postgres"
DB_USER="postgres"
DB_NAME="omni_one"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/omni_one_db_$DATE.sql.gz"

echo "================================================================="
echo "Starting Omni One Database Backup at $(date)"
echo "================================================================="

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform backup using pg_dump inside the container
echo "Running pg_dump..."
if docker exec -t "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -F p | gzip > "$BACKUP_FILE"; then
    echo "Backup completed successfully: $BACKUP_FILE"
    echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "ERROR: Backup failed!"
    exit 1
fi

# Clean up old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "omni_one_db_*.sql.gz" -type f -mtime +$RETENTION_DAYS -exec rm -f {} \;
echo "Cleanup complete."

# Optional: Sync to S3
if [ -n "$S3_BACKUP_BUCKET" ]; then
    echo "Syncing backup to S3 ($S3_BACKUP_BUCKET)..."
    if command -v aws &> /dev/null; then
        aws s3 cp "$BACKUP_FILE" "s3://$S3_BACKUP_BUCKET/database/"
        echo "S3 sync complete."
    else
        echo "WARNING: AWS CLI not found. Skipping S3 sync."
    fi
fi

echo "================================================================="
echo "Backup process finished at $(date)"
echo "================================================================="
