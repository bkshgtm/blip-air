# Use Node 18 (safe, long-term support)
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files and install deps
COPY package*.json ./
RUN npm install --production

# Copy app source
COPY . .

# Ensure the app binds to 0.0.0.0
ENV HOST=0.0.0.0
ENV PORT=3001
ENV NODE_ENV=production

# Expose the port Fly expects to forward
EXPOSE 3001

# Run the app using ESM-compatible command
CMD ["node", "server.js"]
