# Use Node.js 22
FROM node:22-bullseye

# Install system dependencies + yt-dlp (from pip — this is what we actually use)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        python3-pip \
        curl && \
    pip3 install --no-cache-dir streamlink yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
# CRITICAL: Set the env var BEFORE npm install
ENV YT_DLP_EXEC_SKIP_DOWNLOAD=true
# ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

WORKDIR /app

# Now copy package files
COPY package*.json ./

# npm install runs with the env var already active → postinstall script SKIPS GitHub download
RUN npm install --production

# Copy source code
COPY . .

# Start worker
CMD ["node", "src/workers/worker.js"]