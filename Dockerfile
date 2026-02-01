FROM node:25.5-alpine3.23 AS base

WORKDIR /nestjs-docker

RUN apk update \
	&& apk add --no-cache openssl\
	&& rm -rf /var/lib/apt/lists/* \
	&& rm -rf /var/cache/apk/*

RUN npm install -g tar@7.5.7 && \
    pnpm install --ignore-scripts

# Copying all the files in our project
COPY package*.json ./

RUN npm install -g pnpm
RUN pnpm install

COPY . .

ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=1000
ENV CHOKIDAR_BINARY_INTERVAL=3000

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