# Windows Container - Node.js
FROM mcr.microsoft.com/windows/servercore:ltsc2022

SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

# Download and install Node.js
ADD https://nodejs.org/dist/v18.16.0/node-v18.16.0-x64.msi C:\node-install.msi
RUN Start-Process msiexec -ArgumentList '/i C:\node-install.msi /quiet /norestart' -Wait; \
    Remove-Item C:\node-install.msi -Force

# Set environment variables
ENV PATH="C:\Program Files\nodejs;${PATH}"
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund

# Copy application
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD powershell -Command "try { Invoke-WebRequest -Uri http://localhost:3001/health -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"

# Start application
CMD ["node", "server.js"]

LABEL maintainer="research@example.com" \
    service="todo-service" \
    version="1.0.0" \
    os="windows"
