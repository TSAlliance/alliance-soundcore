import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, OnGatewayDisconnect } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { User } from "../../user/entities/user.entity";

export class AuthGatewayRegistry {

    public static users: Record<string, User>;

}
export abstract class AuthGateway implements OnGatewayConnection, OnGatewayDisconnect {

    constructor(private readonly jwtService: JwtService) {}
    
    public handleConnection(socket: Socket, ...args: any[]) {
        const token = socket.handshake.headers.authorization.slice("Bearer ".length);
        console.log(token)
        console.log()
        console.log(this.jwtService.decode(token))

        
    }

    public handleDisconnect(client: any) {
        //
    }

}