FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY proto ./proto
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=America/Guayaquil
COPY --from=builder /app/package.json ./
COPY --from=builder /app/proto ./proto
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3002 50051
CMD ["node", "dist/main.js"]
