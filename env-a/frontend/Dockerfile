FROM nginx:alpine

RUN apk add --no-cache wget

COPY nginx.conf /etc/nginx/nginx.conf
COPY dist/ /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]