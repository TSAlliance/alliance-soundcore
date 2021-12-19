import { Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, readFileSync, ReadStream, writeFileSync } from 'fs';
import NodeID3 from 'node-id3';
import { join } from 'path';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';
import { Artwork } from './entities/artwork.entity';
import { ArtworkType } from './enums/artwork-type.enum';
import { ArtworkRepository } from './repositories/artwork.repository';

const ARTWORK_ROOT_DIR = join(process.cwd(), "artwork-data");
const ARTWORK_SONGS_DIR = join(ARTWORK_ROOT_DIR, ArtworkType.SONG_COVER);
const ARTWORK_ALBUM_DIR = join(ARTWORK_ROOT_DIR, ArtworkType.ALBUM_COVER);
const ARTWORK_PLAYLIST_DIR = join(ARTWORK_ROOT_DIR, ArtworkType.PLAYLIST_COVER);
const ARTWORK_ARTIST_DIR = join(ARTWORK_ROOT_DIR, ArtworkType.ARTIST_COVER);

@Injectable()
export class ArtworkService {

    constructor(private artworkRepository: ArtworkRepository, private storageService: StorageService) {
        mkdirSync(ARTWORK_SONGS_DIR, { recursive: true })
        mkdirSync(ARTWORK_ALBUM_DIR, { recursive: true })
        mkdirSync(ARTWORK_PLAYLIST_DIR, { recursive: true })
        mkdirSync(ARTWORK_ARTIST_DIR, { recursive: true })
    }

    public async streamById(artworkId: string): Promise<ReadStream> {
        const artwork = await this.findById(artworkId);
        if(!artwork) throw new NotFoundException("Artwork not found.");

        const path = await this.getPath(artwork);

        if(!existsSync(path)) {
            this.deleteById(artworkId);
            throw new NotFoundException("File not found.");
        }

        return createReadStream(path)
    }

    private async getPath(artwork: Artwork): Promise<string> {
        return join(ARTWORK_ROOT_DIR, artwork.type, `${artwork.id}.jpeg`);
    }

    public async findById(artworkId: string): Promise<Artwork> {
        return this.artworkRepository.findOne({ where: { id: artworkId }})
    }

    /**
     * Delete an artwork by its id.
     * @param artworkId Id to delete
     */
    public async deleteById(artworkId: string): Promise<void> {
        const artwork: Artwork = await this.artworkRepository.findOne({ where: { id: artworkId }});
        if(!artwork) throw new NotFoundException("Artwork not found.");

        const filepath = await this.getPath(artwork);
        return this.storageService.delete(filepath);
    }

    public async createArtworkFromAudioFile(filepath: string): Promise<Artwork> {
        if(!existsSync(filepath)) {
            return null;
        }

        const id3Tags = NodeID3.read(readFileSync(filepath));
        if(!id3Tags || !id3Tags.image || !id3Tags.image["imageBuffer"]) {
            return null;
        }

        let artwork = new Artwork();
        artwork.type = ArtworkType.SONG_COVER;
        artwork = await this.artworkRepository.save(artwork);

        const destOutputfile: string = await this.getPath(artwork);
        const buffer = id3Tags.image["imageBuffer"];

        writeFileSync(destOutputfile, await sharp(buffer).jpeg({ quality: 90 }).resize(256, 256, { fit: "cover" }).toBuffer())
        return this.artworkRepository.save(artwork)
    }

}
