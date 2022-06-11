import { Album } from "../album/entities/album.entity";
import { Mount } from "../mount/entities/mount.entity";

export class AlbumCreatedEvent {

    constructor(
        public readonly target: Album,
        public readonly mount: Mount
    ) {}

}