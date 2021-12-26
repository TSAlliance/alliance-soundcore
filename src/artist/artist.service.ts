import { Injectable } from '@nestjs/common';
import { Song } from '../song/entities/song.entity';
import { Artist } from './entities/artist.entity';
import { ArtistRepository } from './repositories/artist.repository';

@Injectable()
export class ArtistService {

    constructor(private artistRepository: ArtistRepository){}

    public async findByName(name: string): Promise<Artist> {
        return await this.artistRepository.findOne({ where: { name }});
    }

    public async existsByName(name: string): Promise<boolean> {
        return !!(await this.artistRepository.findOne({ where: { name }}));
    }

    public async createIfNotExists(name: string): Promise<Artist> {
        const artist = await this.findByName(name) || await this.artistRepository.save({ name })
        // TODO: Create artwork for artist.

        return artist;
    }

    /**
     * Add new song to artist.
     * @param song Song to add
     * @param artist Artist
     */
    public async addSongToArtist(song: Song, artist: Artist): Promise<void> {
        artist.songs = [ ...artist.songs, song];
        this.artistRepository.save(artist)
    }

    

}
