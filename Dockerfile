FROM node:22.13.0
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Astro binds host to localhost by default, which is not accessible from outside the container
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

EXPOSE 4321

# Astro hardcodes .env in the build, so we need to build every time we start to have the latest env vars
CMD npm run build && npm run start
