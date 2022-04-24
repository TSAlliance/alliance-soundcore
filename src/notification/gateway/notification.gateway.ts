import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway } from '@nestjs/websockets';
import { AuthGateway } from '../../utils/gateway/auth-gateway';

@WebSocketGateway({
  cors: {
    origin: "*"
  },
  path: "/notifications"
})
export class NotificationGateway extends AuthGateway {

  constructor(jwtService: JwtService) {
    super(jwtService);
  }

  
  
}
