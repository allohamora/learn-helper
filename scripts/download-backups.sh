set -e

mkdir -p .temp/backups

scp "pi@raspberrypi.local:~/projects/learn-helper/.temp/backups/*" .temp/backups/

echo "Backups downloaded to .temp/backups/"
