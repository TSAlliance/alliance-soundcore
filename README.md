## Prerequisites
- Redis installation (REQUIRED)
- NodeJS 14

## Notes when using Nginx as Proxy
Please do not forget to support websocket connections via proxied nginx connections.
This is done by adding these lines inside a location block (where `proxy_pass` is called):
```
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Also Keycloak needs to be configured when using with Docker behind nginx proxy. Run following docker run command:
docker run -p 8888:8080 --env KEYCLOAK_USER="..." --env KEYCLOAK_PASSWORD="..." --env PROXY_ADDRESS_FORWARDING=true --restart=always jboss/keycloak