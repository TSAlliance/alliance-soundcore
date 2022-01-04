import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import NodeID3 from 'node-id3';
import path from 'path';

import ffprobe from 'ffprobe';
import ffprobeStatic from "ffprobe-static";

import fs from 'fs';

import { Index } from '../index/entities/index.entity';
import { CreateSongDTO } from './dtos/create-song.dto';
import { Song } from './entities/song.entity';
import { SongRepository } from './repositories/song.repository';
import { ID3TagsDTO } from './dtos/id3-tags.dto';
import { ArtistService } from '../artist/artist.service';
import { Artist } from '../artist/entities/artist.entity';
import { IndexStatus } from '../index/enum/index-status.enum';
import { GeniusService } from '../genius/services/genius.service';
import { LabelService } from '../label/label.service';
import { PublisherService } from '../publisher/publisher.service';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { Album } from '../album/entities/album.entity';
import { AlbumService } from '../album/album.service';
import { ArtworkService } from '../artwork/artwork.service';

@Injectable()
export class SongService {
    private logger: Logger = new Logger(SongService.name)

    constructor(
        private geniusService: GeniusService,
        private albumService: AlbumService,
        private labelService: LabelService,
        private artworkService: ArtworkService,
        private publisherService: PublisherService,
        private artistService: ArtistService,
        private songRepository: SongRepository
    ){}

    /**
     * Create new song entry in database.
     * @param createSongDto Song data to be saved
     * @returns Song
     */
    private async create(createSongDto: CreateSongDTO): Promise<Song> {
        return this.songRepository.save(createSongDto);
    }

    /**
     * Create song metadata entry in database extracted from an indexed file.
     * @param index Indexed file to get metadata from
     * @returns Index
     */
    public async createFromIndex(index: Index): Promise<Song> {
        const filepath = path.join(index.mount.path, index.filename);
        if(!fs.existsSync(filepath)) throw new NotFoundException("Could not find song file");

        const id3tags = await this.readId3Tags(filepath);
        const song: Song = await this.create({
            duration: id3tags.duration,
            title: id3tags.title
        });

        // Add artists to song
        // and song to artists
        const artists: Artist[] = await Promise.all(id3tags.artists.map(async (id3Artist) => await this.artistService.createIfNotExists(id3Artist.name))) || [];
        song.artists = artists;

        // Getting album info
        const album: Album = await this.albumService.createIfNotExists(id3tags.album, artists);
        song.albums = [ album ];

        // Create artwork
        const artwork = await this.artworkService.createFromIndexAndBuffer(index, id3tags.artwork);
        song.artwork = artwork;

        // Save relations
        index.song = song;
        song.index = index;
        await this.songRepository.save(song);

        try {
            // Request song info on Genius.com
            const result = await this.geniusService.findSongInfo(song);
            if(result) {
                if(result.label) song.label = await this.labelService.createIfNotExists(result.label.name, result.label.id)
                if(result.publisher) song.publisher = await this.publisherService.createIfNotExists(result.publisher.name, result.publisher.id)

                song.location = result.recordingLocation;
                song.youtubeUrl = result.youtubeUrl;
                song.released = result.releaseDate;
                song.geniusId = result.geniusId;
            }

            // Save song metadata
            await this.songRepository.save(song);

            // Set status to OK, as this is the last step of the indexing process
            index.status = IndexStatus.OK;
        } catch (error) {
            this.logger.error(error);
            index.status = IndexStatus.ERRORED;
        }

        // Make sure the index is updated to the song for future internal processing.
        song.index = index;
        return song;
    }

    /**
     * Extract ID3-Tags from audio file.
     * @param filepath Path to the file.
     * @returns ID3TagsDTO
     */
    private async readId3Tags(filepath: string): Promise<ID3TagsDTO> {
        const id3Tags = NodeID3.read(fs.readFileSync(filepath));

        // Get duration in seconds
        const probe = await ffprobe(filepath, { path: ffprobeStatic.path })
        const durationInSeconds = Math.round(probe.streams[0].duration || 0);

        // Get artists
        const artists = id3Tags.artist.split("/") || []
        for(const index in artists) {
            artists.push(...artists[index].split(","))
            artists.splice(parseInt(index), 1)
        }

        // Get artwork buffer
        const artworkBuffer: Buffer = id3Tags?.image?.["imageBuffer"];
    
        return {
            title: id3Tags.title,
            duration: durationInSeconds,
            artists: artists.map((name) => ({ name })),
            album: id3Tags.album,
            artwork: artworkBuffer
        }
    }

    /**
     * Execute search query for a song. This looks up songs that match the query.
     * The search includes looking for songs with a specific artist's name.
     * @param query Query string
     * @param pageable Page settings
     * @returns Page<Song>
     */
    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Song>> {
        if(!query) query = ""
        query = `%${query.replace(/\s/g, '%')}%`;

        // TODO: Sort by "views"?
        // TODO: Add playlists featuring the song / artist

        // Find song by title or if the artist has similar name
        const result = await this.songRepository.find({
            relations: ["artists", "artwork"],
            join: {
                alias: "song",
                innerJoin: {
                    artists: "song.artists"
                }
            },
            where: qb => {
                qb.where({
                    title: ILike(query)
                }).orWhere("artists.name LIKE :query", { query })
            },
            
        })

        return Page.of(result, result.length, pageable.page);
    }

}
