# Use the official Bun image
FROM oven/bun:1.1 AS base
WORKDIR /usr/src/app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Copy dependencies and source code
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Run the app
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "src/index.ts" ]
