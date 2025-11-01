ssh pi@raspberrypi.local "
  cd /projects/learn-helper &&
  git checkout master &&
  git pull &&
  npm ci &&
  npm run push &&
  npm run build &&
  pm2 restart learn-helper
"
