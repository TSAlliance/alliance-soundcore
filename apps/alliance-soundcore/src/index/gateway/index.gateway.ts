import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";
import { Index } from "../entities/index.entity";

export const INDEX_STATUS_EVENT = "onIndexUpdate"

@WebSocketGateway({ 
    path: "/index-status",
    cors: {
        origin: "*",
        credentials: true
    }
})
export class IndexGateway {

    @WebSocketServer() private server: Server;

    /**
     * Send updated audiofile to socket room. The room has the name of the uploaded file id.
     * @param index Updated indexed file
     */
    public async broadcastUpdate(index: Index) {
        try {
            const indexCopy = index;
            delete indexCopy?.song?.artists;
            delete indexCopy?.song?.artwork?.mount;
            delete indexCopy?.song?.index;
            delete indexCopy?.report;

            this.server.emit(INDEX_STATUS_EVENT, indexCopy);
        } catch (error) {
            console.error(error)
        }
    }

}