# Step 1: Build static files
FROM node:23 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Serve static files and reverse proxy API via nginx
FROM nginx:alpine
WORKDIR /app

# Install required tools
RUN apk add --no-cache bash curl

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