# Server Dockerfile - Production Only
FROM node:22-alpine

WORKDIR /app

# Install curl and wget for healthchecks
RUN apk add --no-cache curl wget

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm i

# Copy source code
COPY . .

# Set production environment
ENV NODE_ENV=production

# Generate Prisma Client
RUN npm run db:generate

# Build the server
RUN npm run build

# Expose the port
EXPOSE 3010

# Create startup script that runs migrations then starts the server
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "Running database migrations..."' >> /app/start.sh && \
    echo 'npm run db:migrate:deploy || echo "Migration failed or no migrations to run"' >> /app/start.sh && \
    echo 'echo "Starting server..."' >> /app/start.sh && \
    echo 'exec npm start' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start the server
CMD ["/app/start.sh"] 