FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Default command is the RFQ API
CMD ["bun", "run", "start"]
