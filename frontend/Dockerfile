# Step 1: Build static files
FROM node:24 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Step 2: Serve static files and reverse proxy API via nginx
FROM nginx:1.29
WORKDIR /app

# Install required tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends bash curl gettext-base \
  && rm -rf /var/lib/apt/lists/*

# Copy built frontend files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy and prepare entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENV BACKEND_BASE_URL=http://localhost:8000

ENTRYPOINT ["/entrypoint.sh"]

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -fs http://localhost || exit 1