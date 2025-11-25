# Use Node.js 22
FROM node:22-bullseye

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        python3-pip \
        curl && \
    pip3 install --no-cache-dir streamlink yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Set working dir
WORKDIR /app

# Copy package.json & install (SKIP POSTINSTALL)
COPY package*.json ./
ENV YT_DLP_EXEC_SKIP_DOWNLOAD=true  
RUN npm install --production

# Copy all source files
COPY . .

# Run your worker
CMD ["node", "src/workers/worker.js"]