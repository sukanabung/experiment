# Windows Container - Nginx
FROM mcr.microsoft.com/windows/servercore:ltsc2022

# Install Nginx for Windows
SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue';"]

# Download Nginx
ADD https://nginx.org/download/nginx-1.24.0.zip C:\nginx.zip
RUN Expand-Archive -Path C:\nginx.zip -DestinationPath C:\; \
    Move-Item C:\nginx-1.24.0 C:\nginx; \
    Remove-Item C:\nginx.zip -Force

# Set environment variables
ENV PATH="C:\nginx;${PATH}"

# Create web directory
RUN New-Item -ItemType Directory -Path C:\nginx\html -Force

# Copy nginx configuration
COPY nginx.conf C:\nginx\conf\nginx.conf

# Copy static files
COPY dist\* C:\nginx\html\

    # Expose port
    EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD powershell -Command "try { Invoke-WebRequest -Uri http://localhost:80/ -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"

# Start Nginx
CMD ["C:\\nginx\\nginx.exe", "-g", "daemon off;"]

LABEL maintainer="research@example.com" \
    service="frontend" \
    version="1.0.0" \
    os="windows"

