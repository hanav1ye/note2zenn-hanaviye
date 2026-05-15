FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache git

COPY package.json tsconfig.json ./
RUN npm install

COPY . .
RUN npm run build

USER node

CMD ["node", "dist/index.js"]
