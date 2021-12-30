import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Index } from '../index/entities/index.entity';
import { StorageService } from '../storage/storage.service';
import { Artwork } from './entities/artwork.entity';
import { ArtworkRepository } from './repositories/artwork.repository';

@Injectable()
export class ArtworkService {

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

        sharp(buffer).jpeg({ quality: 80 }).toFile(dstFilepath).catch((error) => {
            console.error(error);
            this.artworkRepository.delete(artwork);
            throw new InternalServerErrorException("Could not create artwork from index: " + index.filename);
        });

        return artwork;
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
