set -e

mkdir -p .temp/uploads

scp "pi@raspberrypi.local:~/projects/learn-helper/.temp/uploads/*" .temp/uploads/

echo "Uploads backups downloaded to .temp/uploads/"
