# Server Dockerfile - Production Only
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Set production environment
ENV NODE_ENV=production

# Build the server (if you have a build step)
RUN npm run build

# Expose the port
EXPOSE 3010

# Start the server
CMD ["npm", "start"] 