import { Injectable, Logger } from "@nestjs/common";
import { CreateArtworkDTO } from "../dtos/create-artwork.dto";
import { Artwork, ArtworkColors, ArtworkFlag } from "../entities/artwork.entity";
import { ArtworkRepository } from "../repositories/artwork.repository";
import fs from "fs";
import sharp from "sharp";
import { ArtworkStorageHelper } from "../helper/artwork-storage.helper";
import path from "path";
import Vibrant from "node-vibrant";
import { Slug } from "../../utils/slugGenerator";

@Injectable()
export class ArtworkService {
    private logger: Logger = new Logger(ArtworkService.name);

    constructor(
        private readonly repository: ArtworkRepository,
        private readonly storageHelper: ArtworkStorageHelper
        // @InjectQueue(QUEUE_ARTWORKWRITE_NAME) private readonly queue: Queue<ArtworkProcessDTO>
    ) {
        // this.queue.on("active", (job: Job<ArtworkProcessDTO>) => this.setFlag(job.data.artwork, ArtworkFlag.PROCESSING));
        // this.queue.on("completed", (job: Job<ArtworkProcessDTO>) => this.setFlag(job.data.artwork, ArtworkFlag.OK));
        // this.queue.on("failed", (job: Job<ArtworkProcessDTO>) => this.setFlag(job.data.artwork, ArtworkFlag.ERROR));
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
     * Find an artwork or create it if it does not exist.
     * For finding the artwork, only the "name", "type" and "mount" properties
     * of the createArtworkDto object are used.
     * @param createArtworkDto Creation and Find options
     * @returns Artwork
     */
    public async findOrCreateArtwork(createArtworkDto: CreateArtworkDTO): Promise<Artwork> {
        const artwork = new Artwork();
        artwork.flag = ArtworkFlag.OK;
        artwork.name = `${Slug.format(createArtworkDto.name)}_${createArtworkDto.type}`;
        artwork.type = createArtworkDto.type;
        artwork.mount = createArtworkDto.mount;

        return this.repository.save(artwork).then((result) => {
            if(!createArtworkDto.fromSource) return result;
            
            return this.writeBufferOrFile(createArtworkDto.fromSource, result).then((writtenArtwork) => {
                return writtenArtwork;
            }).catch((error) => {
                // Delete from database if write failed.
                this.logger.error(`Could not write artwork file: ${error.message}`, error.stack);
                return this.repository.delete(result).then(() => null);
            })
        }).catch(() => {
            return this.repository.createQueryBuilder("artwork")
                .leftJoinAndSelect("artwork.mount", "mount")
                .where("artwork.name = :name AND artwork.type = :type AND artwork.mountId = :mountId", {name: createArtworkDto.name, type: createArtworkDto.type, mountId: createArtworkDto.mount.id })
                .getOne();
        });
    }

    private async writeBufferOrFile(bufferOrFile: string | Buffer, artwork: Artwork): Promise<Artwork> {
        return new Promise((resolve, reject) => {
            const dstFile = this.storageHelper.findArtworkFilepath(artwork);

            let srcBuffer: Buffer;

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
     * @param artwork Artwork to extract color from
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
                })
            })
        })
        
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