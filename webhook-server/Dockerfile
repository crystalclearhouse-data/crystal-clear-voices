FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY webhook-server.js ./

EXPOSE 3002

CMD ["node", "webhook-server.js"]
