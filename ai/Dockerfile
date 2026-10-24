# Build from the repository root: docker build -f ai/Dockerfile -t esham-ai .
FROM python:3.13-slim AS dataset
WORKDIR /app
COPY ai/scripts/prepare_courses.py ai/scripts/prepare_courses.py
RUN python ai/scripts/prepare_courses.py --download --expected-sha256 33ce46426b14039cd7e5b3c65f0fc6fd6bb2102d8d460ef6ed1241c21ec93539

FROM node:22-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app/ai
COPY --chown=node:node ai/package.json ./package.json
COPY --chown=node:node ai/src ./src
COPY --from=dataset --chown=node:node /app/ai/data/processed ./data/processed
USER node
EXPOSE 8080
CMD ["node", "src/gateway.mjs"]
