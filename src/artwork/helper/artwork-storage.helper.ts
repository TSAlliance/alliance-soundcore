import { Injectable, NotFoundException } from "@nestjs/common";
import path from "path";
import { Artwork } from "../entities/artwork.entity";

@Injectable()
export class ArtworkStorageHelper {

    /**
     * Function to return a possible filepath for an
     * artwork. This does not check if the file actually exists.
     * Use this function before writing the file or when reading it.
     * @param artwork Artwork to find path for
     * @returns string
     */
    public findArtworkFilepath(artwork: Artwork): string {
        if(typeof artwork.mount == "undefined" || artwork.mount == null) throw new NotFoundException("No mount present on artwork object.");
        return path.join(artwork.mount.directory, "artworks", `${artwork.name}_${artwork.type}.jpeg`);
    }

}