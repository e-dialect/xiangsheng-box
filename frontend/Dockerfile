FROM node:22-alpine AS build
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package*.json yarn.lock ./
ENV NODE_ENV=production
RUN yarn install --frozen-lockfile --production=false
COPY . .
ARG VITE_BACKEND_URL=VITE_BACKEND_URL_RUNTIME_REPLACEMENT
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
RUN yarn build

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY scripts/replace_backend_url.sh /
RUN chmod +x /replace_backend_url.sh
RUN addgroup -g 10001 app && adduser -D -u 10001 -G app app && \
    sed -i -e '/^user /d' -e 's@pid[[:space:]][^;]*;@pid /tmp/nginx.pid;@' /etc/nginx/nginx.conf && \
    chown -R 10001:10001 /usr/share/nginx/html
COPY --chown=10001:10001 --from=build /usr/src/app/dist/build/h5 /usr/share/nginx/html

USER 10001:10001
EXPOSE 8080
ENTRYPOINT []

CMD ["sh", "/replace_backend_url.sh"]
