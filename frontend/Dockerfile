FROM node:26-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start", "--", "--host", "0.0.0.0"]

FROM nginx:alpine AS prod
COPY --from=dev /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
