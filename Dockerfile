FROM node:25.5-alpine3.23 AS base

WORKDIR /nestjs-docker

RUN apk update \
	&& apk add --no-cache openssl\
	&& rm -rf /var/lib/apt/lists/* \
	&& rm -rf /var/cache/apk/*

# Copying all the files in our project
COPY package*.json ./

RUN npm install -g pnpm

# Installing dependencies
RUN pnpm install

COPY . .

# Increase memory limit for build process
ENV NODE_OPTIONS="--max-old-space-size=2048"

RUN pnpm run build

FROM node:25.5-alpine3.23

RUN apk update \
	&& apk add --no-cache openssl\
	&& rm -rf /var/lib/apt/lists/* \
	&& rm -rf /var/cache/apk/*

WORKDIR /nestjs-docker

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=base /nestjs-docker/node_modules ./node_modules
COPY --from=base /nestjs-docker/dist ./dist
COPY --from=base /nestjs-docker/package.json ./package.json

RUN chown -R appuser:appgroup /nestjs-docker

USER appuser

# Starting our application
CMD ["node", "dist/main.js"]