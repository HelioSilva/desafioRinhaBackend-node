FROM node:lts-alpine@sha256:b2da3316acdc2bec442190a1fe10dc094e7ba4121d029cb32075ff59bb27390a
RUN apk add dumb-init
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm install
USER node
CMD [ "node", "main.js"]