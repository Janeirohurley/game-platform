# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps: dependencies only, so a source-only change does not reinstall them.
# ---------------------------------------------------------------------------
FROM oven/bun:1.4.2 AS deps

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile


# ---------------------------------------------------------------------------
# builder: compiles the app.
#
# NEXT_PUBLIC_* values are inlined into the browser bundle by `next build`,
# so the realtime URL has to be known HERE, not at `docker run`. It arrives as
# a build arg from compose.yaml; changing it requires a rebuild.
# ---------------------------------------------------------------------------
FROM oven/bun:1.4.2 AS builder

WORKDIR /app

ARG NEXT_PUBLIC_REALTIME_URL=http://localhost:2567
ENV NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN bun run build


# ---------------------------------------------------------------------------
# runner: ships only the standalone server, its traced dependencies and the
# static assets. No install step, no source, no dev tooling.
# ---------------------------------------------------------------------------
FROM oven/bun:1.4.2 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

USER bun

EXPOSE 3000

# `server.js` is the entrypoint emitted by `output: "standalone"`.
CMD ["bun", "server.js"]
