# bash here to have nvm setup, without it we will get "nvm: command not found"
ssh pi@raspberrypi.local -t 'bash -i -c "
  cd ~/projects/learn-helper &&
  git checkout master &&
  git pull &&
  npm ci &&
  npm run push &&
  npm run build &&
  pm2 restart learn-helper --update-env
"'
