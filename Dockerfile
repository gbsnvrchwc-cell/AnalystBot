FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# Create data directory for the document store
RUN mkdir -p data docs

# Copy pre-ingested data if it exists (optional)
COPY data/ ./data/ 2>/dev/null || true

EXPOSE 3000

CMD ["node", "src/index.js"]
