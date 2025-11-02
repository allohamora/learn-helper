ssh pi@raspberrypi.local -t '
  set -e &&
  cd ~/projects/learn-helper &&
  TIMESTAMP=$(date +"%Y-%m-%d") &&
  mkdir -p .temp/backups &&
  cp .temp/data.db .temp/backups/$TIMESTAMP-data.db &&
  echo "Backup created at .temp/backups/$TIMESTAMP-data.db"
'
