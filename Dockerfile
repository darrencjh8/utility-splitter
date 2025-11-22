# Build Stage
FROM node:18-alpine as build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

# Accept build args
ARG VITE_API_USER
ARG VITE_API_PASS
# Set as env vars for build
ENV VITE_API_USER=$VITE_API_USER
ENV VITE_API_PASS=$VITE_API_PASS

RUN npm run build

# Production Stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
