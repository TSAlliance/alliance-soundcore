import { ChildEntity, JoinColumn, ManyToOne } from "typeorm";
import { Playlist } from "../../playlist/entities/playlist.entity";
import { Liked } from "./like.entity";

@ChildEntity()
export class LikedPlaylist extends Liked {

    @ManyToOne(() => Playlist, { onDelete: "CASCADE" })
    @JoinColumn()
    public playlist: Playlist;

}