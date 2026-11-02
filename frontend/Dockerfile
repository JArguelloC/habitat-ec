# ==============================================================================
# HÁBITAT EC - FRONTEND SPA (React 19 + TypeScript + Tailwind CSS + Nginx)
# Multi-Stage Production Dockerfile
# ==============================================================================

FROM node:22-alpine AS builder
WORKDIR /app

ARG VITE_API_URL=/api/v1
ARG VITE_GOOGLE_CLIENT_ID=""

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

