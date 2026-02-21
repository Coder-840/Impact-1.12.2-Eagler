FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends maven openjdk-17-jdk-headless \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
