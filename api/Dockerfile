FROM node:20-alpine
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/tsconfig.json ./
COPY api/src ./src
RUN npm run build
EXPOSE 4338
CMD ["node", "dist/main.js"]
