# Front-end Dockerfile (static build served by nginx)
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN adduser -D -H -u 1001 appuser \
	&& chown -R appuser:appuser /usr/share/nginx/html
USER appuser
EXPOSE 80
