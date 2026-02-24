FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --prod
COPY . .
RUN pnpm run build
CMD ["node", "dist/main.js"]
