# Backend Dockerfile for PMA
# Multi-stage not strictly necessary (small), but kept simple.
FROM node:20-alpine
WORKDIR /app
# Install production deps
COPY package*.json ./
RUN npm ci --omit=dev
# Copy source
COPY src ./src
COPY .env.example ./
RUN adduser -D -H -u 1001 appuser \
	&& chown -R appuser:appuser /app
USER appuser
EXPOSE 4000
ENV NODE_ENV=production
CMD ["node","src/index.js"]
