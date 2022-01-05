import { Page } from "nestjs-pager";
import { Album } from "../../album/entities/album.entity";
import { Artist } from "../../artist/entities/artist.entity";
import { Label } from "../../label/entities/label.entity";
import { Publisher } from "../../publisher/entities/publisher.entity";
import { Song } from "../../song/entities/song.entity";

export class ComplexSearchResult {

    public songs?: Page<Song>;
    public artists?: Page<Artist>;
    public albums?: Page<Album>;
    public publisher?: Page<Publisher>;
    public labels?: Page<Label>;

}