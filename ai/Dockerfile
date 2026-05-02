FROM node:20-alpine
WORKDIR /app
COPY ai/package.json ai/package-lock.json ./
RUN npm ci
COPY ai/tsconfig.json ./
COPY ai/src ./src
RUN npm run build
EXPOSE 4337
CMD ["node", "dist/main.js"]
