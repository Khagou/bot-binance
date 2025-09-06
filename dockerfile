FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=development

# Install only prod deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
# Copy built files
COPY --from=build /app/dist ./dist
# Default state location inside container
ENV STATE_FILE=/data/state.json
ENV TZ=Europe/Paris
EXPOSE 8080
CMD ["node", "dist/index.js"]