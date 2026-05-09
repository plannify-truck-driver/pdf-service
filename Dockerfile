FROM node:26.1.0-alpine3.23 AS base

WORKDIR /nestjs-docker

RUN apk update && apk upgrade \
	&& apk add --no-cache openssl \
	&& rm -rf /var/cache/apk/*

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm@10.33.2
RUN pnpm install --frozen-lockfile

COPY . .

ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=1000
ENV CHOKIDAR_BINARY_INTERVAL=3000

RUN pnpm run build

FROM node:26.1.0-alpine3.23

RUN apk update && apk upgrade \
	&& apk add --no-cache openssl \
	&& rm -rf /var/cache/apk/*

WORKDIR /nestjs-docker

RUN npm install -g pnpm@10.33.2

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=base /nestjs-docker/dist ./dist

RUN chown -R appuser:appgroup /nestjs-docker

USER appuser

CMD ["node", "dist/main.js"]