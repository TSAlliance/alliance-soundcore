import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway({
  cors: {
    origin: "*",
    credentials: true
  }
})
export class StatusGateway {  }
