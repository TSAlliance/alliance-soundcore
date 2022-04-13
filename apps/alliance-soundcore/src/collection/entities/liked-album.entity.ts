import { ChildEntity, JoinColumn, ManyToOne } from "typeorm";
import { Album } from "../../album/entities/album.entity";
import { Liked } from "./like.entity";

@ChildEntity("album")
export class LikedAlbum extends Liked {

    @ManyToOne(() => Album, { onDelete: "CASCADE" })
    @JoinColumn()
    public album: Album;

}