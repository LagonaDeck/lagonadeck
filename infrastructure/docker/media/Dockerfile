FROM node:22-bookworm-slim

WORKDIR /workspace
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install --yes --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@12.0.2 && npm ci --ignore-scripts --workspaces=false && chown -R node:node /workspace/node_modules

USER node

