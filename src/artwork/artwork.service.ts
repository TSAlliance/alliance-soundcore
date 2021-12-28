import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Index } from '../index/entities/index.entity';
import { BUCKET_ID } from '../shared/shared.module';
import { StorageService } from '../storage/storage.service';
import { Artwork } from './entities/artwork.entity';
import { ArtworkRepository } from './repositories/artwork.repository';

@Injectable()
export class ArtworkService {

    constructor(
        private storageService: StorageService,
        private artworkRepository: ArtworkRepository,
        @Inject(BUCKET_ID) private bucketId: string
    ){}

    public async findById(artworkId: string): Promise<Artwork> {
        return this.artworkRepository.findOne({ where: { id:artworkId }, relations: ["index"]})
    }

    public buildArtworksDirForIndex(index: Index): string {
        return path.join(this.storageService.getArtworksDir(index.mount), `${index.filename}.jpeg`)
    }

    public async createFromIndexAndBuffer(index: Index, buffer: Buffer): Promise<Artwork> {
        const dstDirectory = this.storageService.getArtworksDir(index.mount);
        mkdirSync(dstDirectory, { recursive: true });

        if(!buffer) return null;

        const artwork = await this.artworkRepository.save({ index });
        const dstFilepath = this.buildArtworksDirForIndex(index);

        sharp(buffer).jpeg({ quality: 90 }).toFile(dstFilepath).catch((error) => {
            console.error(error);
            this.artworkRepository.delete(artwork);
            throw new InternalServerErrorException("Could not create artwork from index: " + index.filename);
        });

        return artwork;
    }

    public async streamArtwork(artworkId: string, response: Response) {
        const artwork = await this.findById(artworkId);
        if(!artwork) throw new NotFoundException("Could not find artwork.");

        const filepath = this.buildArtworksDirForIndex(artwork.index);
        if(!existsSync(filepath)) throw new NotFoundException("Could not find artwork file.");
        createReadStream(filepath).pipe(response);        
    }
    // public async createFromArtist(artist: Artist): Promise<Artwork>

}
