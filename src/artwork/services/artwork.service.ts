import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { CreateArtworkDTO } from "../dtos/create-artwork.dto";
import { Artwork, ArtworkColors, ArtworkFlag, ArtworkType } from "../entities/artwork.entity";
import { ArtworkRepository } from "../repositories/artwork.repository";
import fs from "fs";
import sharp from "sharp";
import { ArtworkStorageHelper } from "../helper/artwork-storage.helper";
import path from "path";
import Vibrant from "node-vibrant";
import { Slug } from "../../utils/slugGenerator";
import { RedisLockableService } from "../../utils/services/redis-lockable.service";
import { RedlockError } from "../../exceptions/redlock.exception";
import axios from "axios";
import { DeleteResult } from "typeorm";
import { Artist } from "../../artist/entities/artist.entity";
import { Mount } from "../../mount/entities/mount.entity";
import { Album } from "../../album/entities/album.entity";
import { Song } from "../../song/entities/song.entity";

@Injectable()
export class ArtworkService extends RedisLockableService {
    private logger: Logger = new Logger(ArtworkService.name);

    constructor(
        private readonly repository: ArtworkRepository,
        private readonly storageHelper: ArtworkStorageHelper
    ) {
        super()
    }

    /**
     * Find an artwork by its id.
     * Included relations: Mount(id, name, directory)
     * @param artworkId 
     * @returns 
     */
    public async findById(artworkId: string): Promise<Artwork> {
        return this.repository.createQueryBuilder("artwork")
            .leftJoin("artwork.mount", "mount")
            .addSelect(["mount.id", "mount.name", "mount.directory"])
            .where("artwork.id = :artworkId", { artworkId })
            .getOne();
    }

    /**
     * Find an artwork by its name and type.
     * @param name Name of the artwork
     * @param type Type of the artwork
     * @returns Artwork
     */
    public async findByNameAndType(name: string, type: ArtworkType): Promise<Artwork> {
        return this.repository.createQueryBuilder("artwork")
            .leftJoinAndSelect("artwork.mount", "mount")
            .where("artwork.name = :name AND artwork.type = :type", { name, type })
            .getOne();
    }

    /**
     * Find an artwork or create it if it does not exist.
     * For finding the artwork, only the "name", "type" and "mount" properties
     * of the createArtworkDto object are used.
     * Should always be called in separate process, as its blocking.
     * @param createArtworkDto Creation and Find options
     * @returns Artwork
     */
    public async createIfNotExists(createArtworkDto: CreateArtworkDTO): Promise<Artwork> {
        createArtworkDto.name = `${Slug.format(createArtworkDto.name)}`;

        return this.lock(createArtworkDto.name, async (signal) => {
            const existingArtwork = await this.findByNameAndType(createArtworkDto.name, createArtworkDto.type);
            if(existingArtwork) return existingArtwork;
            if(signal.aborted) throw new RedlockError();

            const artwork = new Artwork();
            artwork.flag = ArtworkFlag.OK;
            artwork.name = createArtworkDto.name;
            artwork.type = createArtworkDto.type;
            artwork.mount = createArtworkDto.mount;

            return this.repository.save(artwork).then((result) => {
                // If process has not specified a source to write from,
                // then just return created artwork entity.
                if(!createArtworkDto.fromSource) return result;

                // Otherwise write to artwork
                return this.writeFromBufferOrFile(createArtworkDto.fromSource, result);
            });
        });
    }

    /**
     * Function that calls the native createIfNotExists() function but with 
     * preconfigured options to fit requirements for artist artworks.
     * Should always be called in separate process, as its blocking.
     * @param artist Artist's data
     * @param mount Mount to write artwork to
     * @param fromSource (Optional) Filepath or buffer. If not set, no artwork will be written during creation.
     * @returns Artwork
     */
    public async createForArtistIfNotExists(artist: Artist, mount: Mount, fromSource?: string | Buffer): Promise<Artwork> {
        return this.createIfNotExists({ mount, name: artist.name, type: ArtworkType.ARTIST, fromSource })
    }

    /**
     * Function that calls the native createIfNotExists() function but with 
     * preconfigured options to fit requirements for album artworks.
     * Should always be called in separate process, as its blocking.
     * @param album Album's data
     * @param mount Mount to write artwork to
     * @param fromSource (Optional) Filepath or buffer. If not set, no artwork will be written during creation.
     * @returns Artwork
     */
    public async createForAlbumIfNotExists(album: Album, mount: Mount, fromSource?: string | Buffer): Promise<Artwork> {
        if(!album.primaryArtist) throw new NotFoundException("No primary artist present on album data but is required.");
        return this.createIfNotExists({ mount, name: `${album.name} ${album.primaryArtist.name}`, type: ArtworkType.ALBUM, fromSource })
    }

    /**
     * Function that calls the native createIfNotExists() function but with 
     * preconfigured options to fit requirements for song artworks.
     * Should always be called in separate process, as its blocking.
     * @param song Song's data
     * @param mount Mount to write artwork to
     * @param fromSource (Optional) Filepath or buffer. If not set, no artwork will be written during creation.
     * @returns Artwork
     */
     public async createForSongIfNotExists(song: Song, mount: Mount, fromSource?: string | Buffer): Promise<Artwork> {
        if(!song.primaryArtist) throw new NotFoundException("No primary artist present on album data but is required.");
        if(!song.featuredArtists) throw new NotFoundException("No primary artist present on album data but is required.");

        return this.createIfNotExists({ mount, name: `${song.name} ${song.primaryArtist.name} ${song.featuredArtists.map((artist) => artist.name).join(" ")}`, type: ArtworkType.SONG, fromSource })
    }

    /**
     * Download an url into buffer.
     * @param url URL
     * @returns Buffer
     */
    public async downloadToBuffer(url: string): Promise<Buffer> {
        return axios.get(url, { responseType: "arraybuffer" }).then((response) => {
            const buffer = Buffer.from(response.data, "binary");
            return buffer;
        })
    }

    /**
     * Read a buffer or file and write its contents to the artwork file.
     * @param bufferOrFile Buffer or filepath
     * @param artwork Destination artwork object
     * @returns Artwork
     */
    public async writeFromBufferOrFile(bufferOrFile: string | Buffer, artwork: Artwork): Promise<Artwork> {
        return new Promise((resolve, reject) => {
            const dstFile = this.storageHelper.findArtworkFilepath(artwork);
            let srcBuffer: Buffer;

            // Check if parameter is a buffer, if not
            // treat as file and read file into a buffer.
            if(!Buffer.isBuffer(bufferOrFile)) {
                srcBuffer = fs.readFileSync(bufferOrFile as string);
            } else {
                srcBuffer = bufferOrFile as Buffer;
            }


            // Create destination directory
            fs.mkdir(path.dirname(dstFile), { recursive: true }, (err, directory) => {
                if(err) {
                    this.logger.warn(`Could not write artwork to disk: Could not create directory '${directory}': ${err.message}`);
                    reject(err);
                    return;
                }

                // Read source file into buffer and convert to jpeg,
                // compress and resize it. This will write the result into dstFile path
                sharp(srcBuffer).jpeg({ force: true, quality: 80, chromaSubsampling: "4:4:4" }).resize(512, 512, { fit: "cover" }).toFile(dstFile, (err) => {
                    if(err) {
                        this.logger.warn(`Could not write artwork to disk: Failed while processing using sharp: ${err.message}`);
                        reject(err);
                        return;
                    }

                    // Analyze colors from image
                    this.getAccentColorFromArtwork(artwork).then((colors) => {
                        artwork.colors = colors;

                        // Save updated artwork with colors
                        this.repository.save(artwork).then((result) => {
                            resolve(result);
                        }).catch((error) => {
                            reject(error);
                        })
                    }).catch((error) => {
                        reject(error);
                    })
                })
            })
        })
    }

    /**
     * Extract the accent color from an artwork file.
     * @param idOrObject Artwork id or object to extract colors from
     * @returns ArtworkColors
     */
     public async getAccentColorFromArtwork(idOrObject: Artwork): Promise<ArtworkColors> {
        const artwork = await this.resolveArtwork(idOrObject);
        const filepath = this.storageHelper.findArtworkFilepath(artwork);

        return new Promise((resolve, reject) => {
            fs.access(filepath, (err) => {
                if(err) {
                    reject(err);
                    return;
                }

                Vibrant.from(filepath).getPalette().then((palette) => {
                    const colors = new ArtworkColors();
                    colors.vibrant = palette.Vibrant.hex;
                    colors.muted = palette.Muted.hex;
                    colors.darkMuted = palette.DarkMuted.hex;
                    colors.darkVibrant = palette.DarkVibrant.hex;
                    colors.lightMuted = palette.LightMuted.hex;
                    colors.lightVibrant = palette.LightVibrant.hex;
                    resolve(colors);
                }).catch((error) => {
                    reject(error);
                });
            });
        });
    }

    /**
     * Delete an artwork by its id.
     * @param artworkId Artwork's id
     * @returns DeleteResult
     */
    public async deleteById(artworkId: string): Promise<DeleteResult> {
        return this.repository.delete({ id: artworkId });
    }

    /**
     * Update an artworks flag in the database.
     * @param idOrObject Id or Artwork object
     * @param flag ArtworkFlag
     * @returns Artwork
     */
    private async setFlag(idOrObject: string | Artwork, flag: ArtworkFlag): Promise<Artwork> {
        const artwork = await this.resolveArtwork(idOrObject);

        // Check if the flag actually changed.
        // If not, do nothing and return.
        if(artwork.flag == flag) return artwork;

        // Update the flag
        artwork.flag = flag;
        return this.repository.save(artwork);
    }

    /**
     * Resolve the parameter to an artwork entity.
     * If its a string, the parameter is considered an id and the matching
     * entry from the database will be returned.
     * If its an object, the parameter is considered the artwork object which
     * will just be returned.
     * @param idOrObject Id or Artwork object
     * @returns Artwork
     */
    private async resolveArtwork(idOrObject: string | Artwork): Promise<Artwork> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject as Artwork;
    }


}