ssh pi@raspberrypi.local -t '
  set -e &&
  cd ~/projects/learn-helper &&
  TIMESTAMP=$(date +"%Y-%m-%d") &&
  mkdir -p .temp/uploads &&
  kubectl exec -n learn-helper deploy/app -- tar czf - -C /app/uploads . > .temp/uploads/$TIMESTAMP-uploads.tar.gz &&
  echo "Backup created at .temp/uploads/$TIMESTAMP-uploads.tar.gz"
'
