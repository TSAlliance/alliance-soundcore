import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Mount } from '../entities/mount.entity';

export const INDEX_STATUS_EVENT = "onMountUpdate"

@WebSocketGateway({ 
    path: "/mount-status",
    cors: {
        origin: "*",
        credentials: true
    }
})
export class MountGateway implements OnGatewayConnection, OnGatewayDisconnect {

    @WebSocketServer()
    private server: Server;

    // This map is used, to store the userId that matches a certain accessToken.
    // This is used to get the socket that is owned by a certain accessToken.
    // private userIdByAccessToken: Record<string, string> = {}

    // This map contains the socket for an accessToken.
    // private socketByAccessToken: Record<string, Socket> = {}

    // This map stores all accessTokens for a userId.
    // This is used to retrieve accessTokens by a userId to then get
    // a matching socket. This allows for multiple connections for 
    // one user, when in different sessions.
    // private accessTokenByUserId: Record<string, string[]> = {}

    /**
     * Send updated audiofile to socket room. The room has the name of the uploaded file id.
     * @param index Updated indexed file
     */
    public sendUpdate(mount: Mount) {
        try {
            this.server.emit(INDEX_STATUS_EVENT, mount)
        } catch (error) {
            console.error(error)
        }
    } 
    
    /**
     * Register new connection.
     */
    public async handleConnection(client: Socket): Promise<void> {
        const authHeader: string = client.handshake.headers.authorization;
        // const authValue: string = authHeader.slice(7);

        try {
            // Check for auth header. If none exists
            // kill the connection
            if(!authHeader) {
                this.sendError(client, new UnauthorizedException("Authorization Header required."), true)
                return;
            }

            // Fetch user data by provided auth header
            // const user = await this.authService.findUserUsingHeader("@me", authHeader)

            // Fetch user data by provided auth header
            /*if(!user) {
                this.sendError(client, new UnauthorizedException("Account not found."), true)
                return;
            }*/

            // Add access token to registry to later be able to get user info
            // just by access token. So on disconnects we dont have to fetch
            // user info again by the provided accessToken.
            /*if(this.accessTokenByUserId[user?.id]) {
                this.accessTokenByUserId[user?.id].push(authValue)
            } else {
                this.accessTokenByUserId[user?.id] = [authValue]
            }

            // Add socket to map and identify it by this accessToken
            this.socketByAccessToken[authValue] = client;
            this.userIdByAccessToken[authValue] = user?.id;*/
        } catch (error) {
            this.sendError(client, new UnauthorizedException("Authorization Header required."), true)
        }
    }

    /**
     * Unregister connection.
     */
    public async handleDisconnect(client: Socket): Promise<void> {
        /*const token: string = client.handshake.headers.authorization?.slice(7) || "";
        const userId: string = this.userIdByAccessToken[token];
                
        try {
            const tokenIndex: number = this.accessTokenByUserId[userId].indexOf(token);
            this.accessTokenByUserId[userId].splice(tokenIndex, 1);
            if(this.accessTokenByUserId[userId].length <= 0) {
                delete this.accessTokenByUserId[userId];
            }

            delete this.socketByAccessToken[token];
            delete this.userIdByAccessToken[token];
        } catch (error) {
            this.sendError(client, null, true)
        }*/
    }

    /**
     * Find all available sockets for a user's id.
     * @param userId User id to find sockets for
     * @returns Socket[]
     */
    /*public async findSocketsByUserId(userId: string): Promise<Socket[]> {
        const accessTokens = this.accessTokenByUserId[userId] || [];
        if(accessTokens.length <= 0) return [];

        const sockets: Socket[] = [];
        for(const token of accessTokens) {
            const socket = this.socketByAccessToken[token];
            if(socket) sockets.push(socket)
        }

        return sockets;
    }*/

    /**
     * Send an error to a specific socket.
     * @param socket Socket to send error to
     * @param error Error that should be sent
     * @param close Define if the connection should be closed.
     */
    public async sendError(socket: Socket, error?: any, close?: boolean) {
        socket.emit("error", error || new InternalServerErrorException("Internal socket server error occured."));
        if(close) socket.disconnect(close);
    }



}
