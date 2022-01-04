## Notes when using Nginx as Proxy
Please do not forget to support websocket connections via proxied nginx connections.
This is done by adding these lines inside a location block (where `proxy_pass` is called):
```
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```