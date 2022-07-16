import { Artist } from "../artist/entities/artist.entity";
import { Mount } from "../mount/entities/mount.entity";

/**
 * Class to handle either create
 * or update events for artists.
 */
export class ArtistChangedEvent {

    constructor(
        public readonly data: Artist,
        public readonly mount: Mount
    ) {}

}