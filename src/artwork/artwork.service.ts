import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ArtistService } from '../artist/artist.service';
import { Index } from '../index/entities/index.entity';
import { StorageService } from '../storage/storage.service';
import { CreateExternalArtworkDTO } from './dtos/create-external.dto';
import { Artwork } from './entities/artwork.entity';
import { ArtworkRepository } from './repositories/artwork.repository';

@Injectable()
export class ArtworkService {
    private logger: Logger = new Logger(ArtistService.name);

    constructor(
        private storageService: StorageService,
        private artworkRepository: ArtworkRepository
    ){}

    /**
     * Find artwork metadata by its id.
     * @param artworkId Artwork's id.
     * @returns Artwork
     */
    public async findById(artworkId: string): Promise<Artwork> {
        return this.artworkRepository.findOne({ where: { id:artworkId }, relations: ["index"]})
    }

    /**
     * Build artwork directory that fits to an indexed file. This takes the mount of the index
     * and uses that path to build the path to a fitting artwork directory.
     * @param index Index to build directory for
     * @returns string
     */
    public buildArtworksDirForIndex(index: Index): string {
        return path.join(this.storageService.getArtworksDir(index.mount), `${index.filename}.jpeg`)
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

        const artwork = await this.artworkRepository.save({ index });
        const dstFilepath = this.buildArtworksDirForIndex(index);

        return this.writeArtwork(buffer, dstFilepath).then(() => {
            return artwork;
        }).catch((error) => {
            this.logger.warn("Could not create artwork for index " + index.filename);
            this.logger.error(error)
            this.artworkRepository.delete(artwork);
            return null;
        });
    }

    private writeArtwork(buffer: Buffer, dstFilepath: string) {
        return sharp(buffer).jpeg({ quality: 80 }).resize(256, 256, { fit: "cover" }).toFile(dstFilepath)
    }

    /**
     * Create external artwork (url).
     * @param index Index for the relation
     * @param createExternalArtworkDto Additional data like the url
     * @returns Artwork
     */
    public async createExternalForIndex(index: Index, createExternalArtworkDto: CreateExternalArtworkDTO): Promise<Artwork> {
        axios.get(createExternalArtworkDto.url, { responseType: "arraybuffer" }).then((response) => {
            if(response.status == 200 && response.data) {
                response.data as Buffer;
                const dstFilepath = this.buildArtworksDirForIndex(index);
                this.writeArtwork(Buffer.from(response.data), dstFilepath)
            }
        })

        return this.artworkRepository.save({
            index,
            external: true,
            externalUrl: createExternalArtworkDto.url
        })
    }

    /**
     * Create a readstream for an artwork and pipe it directly to the response.
     * @param artworkId Requested artwork's id.
     * @param response Response to pipe stream to.
     */
    public async streamArtwork(artworkId: string, response: Response) {
        const artwork = await this.findById(artworkId);
        if(!artwork) throw new NotFoundException("Could not find artwork.");

        const filepath = this.buildArtworksDirForIndex(artwork.index);
        if(!existsSync(filepath)) throw new NotFoundException("Could not find artwork file.");
        createReadStream(filepath).pipe(response);        
    }

}
