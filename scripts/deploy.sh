# bash here to have nvm setup, without it we will get "nvm: command not found"
ssh pi@raspberrypi.local -t 'bash -i -c "
  set -e &&
  cd ~/projects/learn-helper &&
  git reset --hard &&
  git checkout master &&
  git pull origin master &&
  npm ci &&
  npm run build &&
  npm run push &&
  pm2 restart learn-helper --update-env
"'
