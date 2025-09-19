# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with production flag to reduce memory usage
RUN npm install --production=false --prefer-offline

# Copy source code
COPY . .

# Accept Vite environment at build time
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_ENABLE_ALERTS
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_ENABLE_ALERTS=${VITE_ENABLE_ALERTS}

# Set Node.js memory limit and build the application
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 