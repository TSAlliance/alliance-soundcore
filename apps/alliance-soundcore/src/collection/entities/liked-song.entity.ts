import { ChildEntity, JoinColumn, ManyToOne } from "typeorm";
import { Song } from "../../song/entities/song.entity";
import { Liked } from "./like.entity";

@ChildEntity("song")
export class LikedSong extends Liked {

    @ManyToOne(() => Song, { onDelete: "CASCADE" })
    @JoinColumn()
    public song: Song;

}