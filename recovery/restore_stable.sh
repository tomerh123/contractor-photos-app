#!/bin/zsh

# Recovery script for Contractor Photos App (Snapshot: 2026-03-08)
# Reverts layout and navigation files to a stable state.

BACKUP_DIR="recovery/backups"

echo "Attempting to restore stable layout snapshot..."

if [[ -d "$BACKUP_DIR" ]]; then
    cp "$BACKUP_DIR/App.jsx" "src/App.jsx"
    cp "$BACKUP_DIR/ProjectList.jsx" "src/components/ProjectList.jsx"
    cp "$BACKUP_DIR/ProjectDetail.jsx" "src/components/ProjectDetail.jsx"
    cp "$BACKUP_DIR/AllPhotosView.jsx" "src/components/AllPhotosView.jsx"
    cp "$BACKUP_DIR/MyMarkupsView.jsx" "src/components/MyMarkupsView.jsx"
    cp "$BACKUP_DIR/index.css" "src/index.css"
    echo "Restoration complete! Please rebuild and redeploy."
else
    echo "Error: Backup directory $BACKUP_DIR not found."
    exit 1
fi
