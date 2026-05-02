FROM node:20-alpine
WORKDIR /app
COPY listener/package.json listener/package-lock.json ./
RUN npm ci
COPY listener/tsconfig.json ./
COPY listener/src ./src
RUN npm run build
CMD ["node", "dist/main.js"]
