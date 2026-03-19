# Server Dockerfile - Production Only
FROM node:22-alpine

WORKDIR /app

# Install curl for healthchecks
RUN apk add --no-cache curl

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY . .
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3010

CMD ["npm", "start"]
