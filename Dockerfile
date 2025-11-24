# Build Stage
FROM node:18-alpine AS build
WORKDIR /app

# Copy root package files for frontend build
COPY package.json package-lock.json ./
RUN npm install

# Copy frontend source code
COPY . .

# Build arguments for frontend (passed from fly.toml or secrets)
ARG VITE_API_USER
ARG VITE_API_PASS
ENV VITE_API_USER=$VITE_API_USER
ENV VITE_API_PASS=$VITE_API_PASS

# Build the frontend
RUN npm run build

# Runtime Stage
# Runtime Stage
FROM nginx:alpine

# Copy built frontend from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
