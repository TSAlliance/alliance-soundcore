FROM node:16.14.2-alpine as production
ARG DIR=/usr/soundcore

WORKDIR ${DIR}

# Copy required files for build steps
RUN mkdir src/

COPY package*.json .
COPY tsconfig.* .
COPY .eslintrc* .
COPY nest-cli*.json .
COPY src ./src

RUN npm install -g npm@latest @nestjs/cli rimraf glob
RUN npm install
RUN npm run build

# Install frontend
RUN mkdir app-src/
RUN mkdir app/

COPY app/ ./app

RUN npm install -g @angular/cli
RUN npm install --prefix="./app"
RUN npm run build --prefix="./app"
RUN npm uninstall --prefix="./app"

EXPOSE 3000/tcp
ENTRYPOINT [ "node", "dist/main" ]