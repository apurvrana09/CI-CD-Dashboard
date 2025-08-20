# Use Node.js 18 Debian (bullseye) as base image for Prisma OpenSSL compatibility
FROM node:18-bullseye

# Set working directory
WORKDIR /app

# Copy package files and Prisma schema early so postinstall can find schema
COPY package*.json ./
COPY prisma ./prisma

# Install system dependencies required by Prisma engines (OpenSSL)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (omit dev deps for production)
RUN npm install --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create logs directory
RUN mkdir -p logs

# Create non-root user (Debian)
RUN groupadd -g 1001 nodejs \
  && useradd -m -u 1001 -g 1001 -s /bin/bash nodejs

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application (ensure database schema is up to date in production)
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]