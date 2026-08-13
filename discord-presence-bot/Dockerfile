FROM node:20-alpine

WORKDIR /app

# ws est la seule dépendance : pas de lockfile, npm l'installe au build.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY index.js ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "index.js"]
