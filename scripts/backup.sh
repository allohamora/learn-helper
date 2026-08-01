ssh pi@raspberrypi.local -t '
  set -e &&
  cd ~/projects/learn-helper &&
  TIMESTAMP=$(date +"%Y-%m-%d") &&
  mkdir -p .temp/backups &&
  kubectl exec -n learn-helper deploy/postgres -- sh -c "pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"" | gzip > .temp/backups/$TIMESTAMP-data.sql.gz &&
  echo "Backup created at .temp/backups/$TIMESTAMP-data.sql.gz"
'
