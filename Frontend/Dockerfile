FROM node:24-alpine AS builder

WORKDIR /app

# Vite inlines VITE_API_URL at build time (API host the browser calls).
# Google client id is NOT baked here — the UI loads it from GET /auth/google/config.
ARG VITE_API_URL=http://127.0.0.1:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
