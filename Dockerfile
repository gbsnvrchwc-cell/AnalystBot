FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Copy docs and data directories (must exist in repo)
COPY docs/ ./docs/
COPY data/ ./data/

EXPOSE 3000

CMD ["node", "src/index.js"]
