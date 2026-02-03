# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY index.html ./
COPY public ./public
COPY src ./src
COPY vite.config.* ./
COPY tsconfig*.json ./
COPY tailwind.config.js postcss.config.js ./

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
