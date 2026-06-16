FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY server/package*.json ./server/
RUN npm --prefix server ci --omit=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server/index.js"]
