FROM node:24.14.1
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ENV NODE_ENV=production
RUN npm run build

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "start"]
