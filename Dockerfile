# Use lightweight Node image
FROM node:22-alpine

# Install ffmpeg, Python, and Streamlink
RUN apk add --no-cache ffmpeg python3 py3-pip \
  && pip3 install --no-cache-dir streamlink

# Create and set working directory
WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install --production

# Copy all source code
COPY . .

# Start worker
CMD ["node", "src/workers/worker.js"]
