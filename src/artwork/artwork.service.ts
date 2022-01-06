import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ArtistService } from '../artist/artist.service';
import { Index } from '../index/entities/index.entity';
import { MOUNT_ID } from '../shared/shared.module';
import { StorageService } from '../storage/storage.service';
import { CreateArtworkDTO } from './dtos/create-artwork.dto';
import { Artwork } from './entities/artwork.entity';
import { ArtworkRepository } from './repositories/artwork.repository';

@Injectable()
export class ArtworkService {
    private logger: Logger = new Logger(ArtistService.name);

    constructor(
        private storageService: StorageService,
        private artworkRepository: ArtworkRepository,
        @Inject(MOUNT_ID) private mountId: string
    ){}

    /**
     * Find artwork metadata by its id.
     * @param artworkId Artwork's id.
     * @returns Artwork
     */
    public async findByIdWithMount(artworkId: string): Promise<Artwork> {
        return this.artworkRepository.findOne({ where: { id:artworkId }, relations: ["mount"]})
    }

    /**
     * Build artwork directory that fits to an artwork file. This takes the mount
     * and uses that path to build the path to a fitting artwork directory.
     * @param mount Mount of the dest artwork file
     * @returns string
     */
    public buildArtworkFile(artwork: Artwork): string {
        return path.join(this.storageService.getArtworksDir(artwork.mount), (artwork.type || "song").toString() , `${artwork.id}.jpeg`)
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

        if(!buffer) return null;

        // Create new artwork instance in database
        const artwork = await this.create({
            type: "song",
            mountId: index.mount.id,
            autoDownload: false // There is nothing that could be downloaded
        })

        // Write artwork to file
        return this.writeArtwork(buffer, artwork).then(() => {
            return artwork;
        }).catch(() => {
            return null;
        })
    }

    private async writeArtwork(buffer: Buffer, artwork: Artwork) {
        const dstFilepath = this.buildArtworkFile(artwork);
        const directory = path.dirname(dstFilepath);
        mkdirSync(directory, { recursive: true });

        let sharpProcess = sharp(buffer).jpeg({ quality: 80 });

        // Only resize image if its not of type banner
        if(artwork.type != "banner") {
            sharpProcess = sharpProcess.resize(256, 256, { fit: "cover" })
        }

        return await sharpProcess.toFile(dstFilepath).catch((reason) => {
            this.logger.error(reason)
            this.artworkRepository.delete(artwork)
            throw reason;
        })
    }

    /**
     * Create external artwork (url).
     * @param createExternalArtworkDto Additional data like the url
     * @returns Artwork
     */
     public async create(createExternalArtworkDto: CreateArtworkDTO): Promise<Artwork> {
        const artworkCreatResult = await this.artworkRepository.save({
            mount: { id: createExternalArtworkDto.mountId || this.mountId },
            type: createExternalArtworkDto.type,
            externalUrl: createExternalArtworkDto.url
        });
        const artwork = await this.artworkRepository.findOne({ where: { id: artworkCreatResult.id }, relations: ["mount"]})

        // Check if a url was specified and the image should be
        // downloaded automatically.
        if(artwork.externalUrl && createExternalArtworkDto.autoDownload) {
            // Download the image from the url.
            return await this.downloadArtworkByUrl(artwork).then((artwork) => {
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

    private async downloadArtworkByUrl(artwork: Artwork) {
        return axios.get(artwork.externalUrl, { responseType: "arraybuffer" }).then((response) => {
            if(response.status == 200 && response.data) {
                return this.writeArtwork(Buffer.from(response.data), artwork).then(() => {
                    return artwork
                })
            }
        }).catch((error) => {
            this.logger.error(error)
            throw error;
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

}
