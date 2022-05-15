import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import fs from "fs"
import { ArtistService } from '../artist/artist.service';
import { Index } from '../index/entities/index.entity';
import { MOUNT_ID } from '../shared/shared.module';
import { StorageService } from '../storage/storage.service';
import { CreateArtworkDTO } from './dtos/create-artwork.dto';
import { Artwork } from './entities/artwork.entity';
import { ArtworkRepository } from './repositories/artwork.repository';
import { ArtworkType } from './types/artwork-type.enum';

import Vibrant from "node-vibrant"
import { v4 as uuidv4 } from "uuid"
import sanitize from 'sanitize-filename';
import { IndexReportService } from '../index-report/services/index-report.service';
import { RandomUtil } from '@tsalliance/rest';

@Injectable()
export class ArtworkService {
    private logger: Logger = new Logger(ArtistService.name);

    constructor(
        private storageService: StorageService,
        private indexReportService: IndexReportService,
        private artworkRepository: ArtworkRepository,
        @Inject(MOUNT_ID) private mountId: string
    ){}

    /**
     * Find artwork metadata by its id.
     * @param artworkId Artwork's id.
     * @returns Artwork
     */
     public async findById(artworkId: string): Promise<Artwork> {
         if(!artworkId) return null;
        return this.artworkRepository.findOne({ where: { id:artworkId }, relations: ["mount"]})
    }

    /**
     * Find artwork metadata by its id.
     * @param artworkId Artwork's id.
     * @returns Artwork
     */
    public async findByIdWithMount(artworkId: string): Promise<Artwork> {
        return this.artworkRepository.findOne({ where: { id:artworkId }, relations: ["mount"]})
    }

    /**
     * Find an artwork by its type and filename.
     * @param type Type
     * @param filename Filename
     * @returns Artwork
     */
    public async findByTypeAndFilename(type: ArtworkType, filename: string): Promise<Artwork> {
        return await this.artworkRepository.findOne({ where: { type, dstFilename: filename }})
    }

    /**
     * Build artwork directory that fits to an artwork file. This takes the mount
     * and uses that path to build the path to a fitting artwork directory.
     * @param mount Mount of the dest artwork file
     * @returns string
     */
    public buildArtworkFile(artwork: Artwork): string {
        return path.join(this.storageService.getArtworksDir(artwork.mount), (artwork.type || "song").toString() , `${sanitize(artwork.dstFilename)}.jpeg`)
    }

    /**
     * Extract the accent color from an artwork file.
     * @param artwork Artwork to extract color from
     * @returns Hex string
     */
    public async getAccentColorFromArtwork(artwork: Artwork): Promise<string> {
        const filepath = this.buildArtworkFile(artwork);
        if(!existsSync(filepath)) return null;
        return (await Vibrant.from(filepath).getPalette()).Vibrant.hex
    }

    /**
     * Extract the accent color from an avatar url.
     * @param avatarUrl Artwork to extract color from
     * @returns Hex string
     */
     public async getAccentColorFromAvatar(avatarUrl: string): Promise<string> {
        return new Promise((resolve) => {
            const tmpFilepath = this.storageService.buildTmpFilepath();

            this.downloadImageUrl(avatarUrl).then((buffer) => {
                fs.writeFile(tmpFilepath, buffer, (err) => {
                    if(err) {
                        console.error(err)
                        resolve(null)
                        return
                    }

                    Vibrant.from(tmpFilepath).getPalette().then((palette) => {
                        resolve(palette.Vibrant.hex)
                    }).catch(() => {
                        resolve(null)
                    })
                })
            }).catch(() => {
                resolve(null)
            })
        })
    }

    public async duplicateArtwork(src: Artwork, dstType: ArtworkType, dstName: string): Promise<Artwork> {
        const artwork = await this.create({
            dstFilename: sanitize(dstName),
            mountId: src.mount?.id || this.mountId,
            type: dstType
        }, true)

        const srcPath = this.buildArtworkFile(src);
        const dstPath = this.buildArtworkFile(artwork);
        const srcBuffer = fs.readFileSync(srcPath);

        this.writeBufferToFile(srcBuffer, dstPath);
        return artwork;
    }

    /**
     * Replace image inside src artwork with the image of dstArtwork
     * @param src Artwork to use, will become the image of dest.
     * @param dest Artwork which file should be replace by src.
     * @returns Artwork
     */
    public async replace(src: Artwork, dest: Artwork): Promise<Artwork> {
        const srcPath = this.buildArtworkFile(src);
        const dstPath = this.buildArtworkFile(dest);
        const srcBuffer = fs.readFileSync(srcPath);

        this.writeBufferToFile(srcBuffer, dstPath);
        return dest;
    }

    /**
     * Write the extracted image of an indexed file to the disk.
     * @param index Indexed file the artwork belongs to.
     * @param buffer Image data to be written.
     * @returns Artwork
     */
    public async createFromIndexAndBuffer(index: Index, buffer: Buffer): Promise<Artwork> {
        const dstDirectory = this.storageService.getArtworksDir(index.mount);
        mkdirSync(dstDirectory, { recursive: true });

        if(!buffer) {
            this.indexReportService.appendWarn(index.report, "Artwork buffer on file is empty. Not creating artwork")
            return null;
        }

        // Somehow there are duplicates on banner images
        // Test again if indexing is done. If error persists, then its a real thing
        // and the image files are somehow same (but how is that possible? Random string is appended every time)

        // Create new artwork instance in database

        const artwork = await this.create({
            type: "song",
            mountId: index.mount.id,
            dstFilename: index.name,
            autoDownload: false // There is nothing that could be downloaded
        }).catch((reason) => {
            this.indexReportService.appendError(index.report, `Unable to save artwork to database: ${reason.message}`);
            return null;
        })

        // Write artwork to file
        return this.writeArtwork(buffer, artwork, index).catch((reason) => {
            throw reason
        })
    }

    /**
     * Create external artwork (url).
     * @param createArtworkDto Additional data like the url
     * @returns Artwork
     */
     public async create(createArtworkDto: CreateArtworkDTO, autoGenerated = false): Promise<Artwork> {
        if(createArtworkDto.url && createArtworkDto.url.includes("default_avatar")) return null;

        const artworkCreateResult = await this.artworkRepository.save({
            mount: { id: createArtworkDto.mountId || this.mountId },
            type: createArtworkDto.type,
            externalUrl: createArtworkDto.url,
            autoGenerated,
            key: RandomUtil.randomString(6),
            dstFilename: createArtworkDto.dstFilename  // Prevent naming duplicates
        }).catch((error) => {
            console.error(error)
            return null;
        });

        if(!artworkCreateResult) return null;
        const artwork = await this.artworkRepository.findOne({ where: { id: artworkCreateResult.id }, relations: ["mount"]})

        // Check if a url was specified and the image should be
        // downloaded automatically.
        if(artwork.externalUrl && createArtworkDto.autoDownload) {
            // Download the image from the url.
            return await this.downloadAndWriteArtworkByUrl(artwork).then(async (artwork) => {
                artwork.externalUrl = null;
                this.artworkRepository.save(artwork);
                return artwork;
            }).catch(() => {
                this.artworkRepository.delete(artwork);
                return null;
            })
        }
        
        return artwork;
    }

    /**
     * Download an image from the provided url.
     * @param url Url to the image
     * @returns Buffer
     */
    public async downloadImageUrl(url: string): Promise<Buffer> {
        return axios.get(url, { responseType: "arraybuffer" }).then((response) => {
            if(response.status == 200 && response.data) {
                return Buffer.from(response.data)
            }
        }).catch((error) => {
            this.logger.error(error)
            return null;
        })
    }

    /**
     * Create a readstream for an artwork and pipe it directly to the response.
     * @param artworkId Requested artwork's id.
     * @param response Response to pipe stream to.
     */
     public async streamArtwork(artworkId: string, response: Response) {
        const artwork = await this.findByIdWithMount(artworkId);
        if(!artwork) throw new NotFoundException("Could not find artwork.");

        const filepath = this.buildArtworkFile(artwork);
        if(!existsSync(filepath)) throw new NotFoundException("Could not find artwork file.");
        createReadStream(filepath).pipe(response);        
    }

    /**
     * Write a buffer to a temporary file. This generates a filepath, writes the data and returns the filepath as string
     * @param buffer Buffer data to be written
     * @returns string
     */
    public async writeBufferToTmp(buffer: Buffer): Promise<string> {
        if(!buffer) return null;
        const dstFilepath = path.join(this.storageService.getTmpDir(), `${uuidv4()}.jpg`);
        return this.writeBufferToFile(buffer, dstFilepath);
    }

    /**
     * Write a buffer to a file
     * @param buffer Buffer data to be written
     * @returns string
     */
    private async writeBufferToFile(buffer: Buffer, filepath: string): Promise<string> {
        if(!buffer) return null;

        return new Promise((resolve, reject) => {
            const directory = path.dirname(filepath);
            mkdirSync(directory, { recursive: true });

            fs.writeFile(filepath, buffer, (err) => {
                if(!err) {
                    resolve(filepath)
                    return
                } else {
                    console.error(err)
                    reject(err)
                }
            })
        })
    }

    /**
     * Write artwork buffer to filesystem.
     * @param buffer Data to be written
     * @param artwork Artwork data used to build the filepath
     * @returns Artwork
     */
     private async writeArtwork(buffer: Buffer, artwork: Artwork, indexContext?: Index): Promise<Artwork> {
        if(!buffer) return null;
        const dstFilepath = this.buildArtworkFile(artwork);

        return this.optimizeImageBuffer(buffer, artwork.type).then(async () => {
            await (this.writeBufferToFile(buffer, dstFilepath).catch((reason) => {
                if(indexContext) this.indexReportService.appendError(indexContext.report, `Failed writing artwork to disk: ${reason.message}`)
            }))

            // Extract accent color and save to database
            artwork.accentColor = await this.getAccentColorFromArtwork(artwork);
            await this.artworkRepository.save(artwork)
            return artwork;
        }).catch((reason) => {
            this.logger.error(reason)
            this.artworkRepository.delete(artwork)
            throw reason;
        })
    }

    /**
     * Download image of an artwork by the provided url. This also writes the result to disk.
     * @param artwork Artwork data including the externalUrl used for downloading
     * @returns 
     */
    private async downloadAndWriteArtworkByUrl(artwork: Artwork) {
        return axios.get(artwork.externalUrl, { responseType: "arraybuffer" }).then((response) => {
            if(response.status == 200 && response.data) {
                return this.writeArtwork(Buffer.from(response.data), artwork)
            }
        }).catch((error) => {
            this.logger.error(error)
            throw error;
        })
    }

    /**
     * Transform an image buffer to jpeg and apply resize options by provided type.
     * @param buffer Image Buffer
     * @param type Type of the result. Banner, if the original measures should be kept. Otherwise a squared image is the outcome
     * @returns Buffer
     */
    public async optimizeImageBuffer(buffer: Buffer, type: ArtworkType): Promise<Buffer> {
        if(!buffer) return null;

        let sharpProcess = sharp(buffer);

        // Only resize image if its not of type banner
        if(!type.toString().includes("banner")) {
            sharpProcess = sharpProcess.jpeg({ quality: 85 }).resize(256, 256, { fit: "cover" })
        } else {
            // Make lower quality for banner images
            sharpProcess = sharpProcess.jpeg({ quality: 85 })
        }

        return sharpProcess.toBuffer();
    }

}
