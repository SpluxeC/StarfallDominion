FROM node:22-alpine
WORKDIR /srv/starfall
COPY multiplayer ./multiplayer
RUN mkdir -p /data && chown -R node:node /data /srv/starfall
USER node
ENV NODE_ENV=production
ENV PORT=8788
ENV HOST=0.0.0.0
ENV STARFALL_DATA_PATH=/data/galaxy.json
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8788/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","multiplayer/server.cjs"]
