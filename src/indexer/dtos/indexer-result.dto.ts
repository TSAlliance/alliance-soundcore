import { Album } from "../../album/entities/album.entity";
import { Artist } from "../../artist/entities/artist.entity";
import { Mount } from "../../mount/entities/mount.entity";
import { Song } from "../../song/entities/song.entity";

export class IndexerResultDTO {

    createdArtists: Artist[];
    createdAlbum: Album;
    createdSong: Song;
    song: Song;
    mount: Mount;

}