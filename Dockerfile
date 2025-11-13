FROM node:22-bullseye

RUN apt-get update && apt-get install -y ffmpeg python3-pip \
 && pip3 install streamlink

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "src/workers/worker.js"]
