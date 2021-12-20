import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Artwork } from "../entities/artwork.entity";
import { ArtworkType } from "../enums/artwork-type.enum";
import { ArtworkRepository } from "../repositories/artwork.repository";

type GroupedArtworks = { [key: string]: Artwork[] }

@Injectable()
export class CleanArtworkService {
    private readonly logger = new Logger("Artwork Cleanup");

    constructor(private artworkRepository: ArtworkRepository) {
        this.handleUploadCleanup();
    }

    /**
     * Cleanup dead entries on system and database
     * This is triggered every da at 8 o'clock
     */
    @Cron("0 0 8 * * *")
    public async handleUploadCleanup() {
        this.logger.log("Cleaning up artworks");

        await this.cleanArtworks();

        this.logger.log("Cleanup done");
    }

    /**
     * Delete artworks from disk that have no database entry
     */
    private async cleanArtworks() {
        const artworks: GroupedArtworks = (await this.artworkRepository.find()).reduce((result: GroupedArtworks, artwork: Artwork) => {
            if(result[artwork.type]) {
                result[artwork.type].push(artwork);
            } else {
                result[artwork.type] = [artwork];
            }
            return result;
        }, {});

        // TODO

        for(const key of Object.values(ArtworkType)) {

        }

        for(const key in artworks) {
            if(Object.values(ArtworkType).includes(key as ArtworkType)) {
                console.log(key)
            }
            
        }

        

        // console.log(artworks)


        /*const audioDirectories = readdirSync(UPLOAD_SONGS_DIR);
        const deadEntries = (await this.uploadRepository.find()).filter((entry) => !audioDirectories.includes(entry.id)).map((entry) => entry.id);

        if(deadEntries.length > 0) {
            this.logger.log(`Found ${deadEntries.length} entries that have no existing file, but are listed in the database. Deleting...`);
            await this.uploadRepository.delete({ id: In(deadEntries)});
        }*/
    }
}