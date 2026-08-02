ssh pi@raspberrypi.local -t '
  set -e &&
  cd ~/projects/learn-helper &&
  TIMESTAMP=$(date +"%Y-%m-%d") &&
  mkdir -p .temp/backups &&
  kubectl exec -n learn-helper deploy/postgres -- sh -c "pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"" > .temp/backups/$TIMESTAMP-data.sql &&
  gzip .temp/backups/$TIMESTAMP-data.sql &&
  echo "Backup created at .temp/backups/$TIMESTAMP-data.sql.gz"
'
