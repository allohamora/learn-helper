FROM node:22.13.0
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4321

CMD npm run dev
