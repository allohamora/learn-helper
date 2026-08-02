FROM node:24.14.1
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ENV NODE_ENV=production
RUN --mount=type=secret,id=sentry_org,env=SENTRY_ORG \
    --mount=type=secret,id=sentry_project,env=SENTRY_PROJECT \
    --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=vite_sentry_dsn,env=VITE_SENTRY_DSN \
    npm run build

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "start"]
