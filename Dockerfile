FROM node:16.15-alpine
LABEL maintainer="Cedric Zitzmann <cedric.zitzmann@gmail.com>"
LABEL repository="https://github.com/TSAlliance/alliance-soundcore"

ARG ROOT=/opt/soundcore/api
WORKDIR ${ROOT}

# Copy required files for build steps
COPY dist/* ${ROOT}
RUN ls -la
RUN npm install

ENV NODE_ENV=production

EXPOSE 3001/tcp
ENTRYPOINT [ "npm", "run", "start" ]