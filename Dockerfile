# Server Dockerfile - Production
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Install all deps (including devDeps) so tsc is available for the build
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Prune devDependencies after build
RUN npm prune --omit=dev

EXPOSE 3010

CMD ["npm", "start"]
