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
import { Page, Pageable } from 'nestjs-pager';
import { ILike, In } from 'typeorm';
import { Album } from '../album/entities/album.entity';
import { AlbumService } from '../album/album.service';
import { ArtworkService } from '../artwork/artwork.service';

@Injectable()
export class SongService {
    private logger: Logger = new Logger(SongService.name)

    constructor(
        private geniusService: GeniusService,
        private albumService: AlbumService,
        private artworkService: ArtworkService,
        private artistService: ArtistService,
        private songRepository: SongRepository
    ){}

    /**
     * Find page with the 20 latest indexed songs.
     * @returns Page<Song>
     */
    public async findLatestPage(): Promise<Page<Song>> {
        return this.songRepository.findAll({ size: 20, page: 0 }, {
            order: {
                createdAt: "DESC",
                released: "DESC"
            },
            relations: ["artwork", "artists"]
        });
    }

    /**
     * Find page with the oldest songs by their actual release date
     * @returns Page<Song>
     */
    public async findOldestReleasePage(): Promise<Page<Song>> {
        return this.songRepository.findAll({ size: 20, page: 0 }, {
            order: {
                released: "ASC",
                createdAt: "ASC"
            },
            relations: ["artwork", "artists"]
        });
    }

    /**
     * Find song by its id including its indexed file info.
     * @param songId Song's id
     * @returns Song
     */
    public async findByIdWithIndex(songId: string): Promise<Song> {
        return this.songRepository.findOne({ where: { id: songId }, relations: ["index", "index.mount"]})
    }

    public async findByGenre(genreId: string, pageable: Pageable): Promise<Page<Song>> {
        console.log(genreId)

        // TODO: Count all available items for pagination

        const result = await this.songRepository.find({
            relations: ["genres", "artwork", "artists"],
            join: {
                alias: "song",
                leftJoin: {
                    genres: "song.genres"
                }
            },
            where: qb => {
                qb.where("genres.id = :genreId", { genreId })
            },
            skip: (pageable?.page || 0) * (pageable?.size || 10),
            take: (pageable.size || 10)
        })

        return Page.of(result, result.length, pageable.page);

        //console.log(genreId)
        //return this.songRepository.findAll(pageable, { where: { genres: { id: In([ genreId ]) }}})
    }

    /**
     * Find all songs uploaded by specific user.
     * @param uploaderId Uploader's id
     * @param pageable Page settings
     * @returns Page<Song>
     */
    public async findByUploaderId(uploaderId: string, pageable: Pageable): Promise<Page<Song>> {
        return this.songRepository.findAll(pageable, {
            relations: ["index", "index.uploader", "artwork", "artists"],
            where: {
                index: {
                    uploader: {
                        id: uploaderId
                    }
                }
            }
        })
    }

    /**
     * Find song by its id including all relations that contain information that may be interesting for users.
     * @param songId Songs' id
     * @returns Song
     */
    public async findByIdInfoWithRelations(songId: string): Promise<Song> {
        return this.songRepository.findOne({ where: { id: songId }, relations: ["label", "publisher", "artists", "artwork", "banner", "distributor", "albums", "genres"]})
    }

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

        try {
            // Create artwork
            const artwork = await this.artworkService.createFromIndexAndBuffer(index, id3tags.artwork);
            if(artwork) song.artwork = artwork;

            // Add artists to song
            // and song to artists
            const artists: Artist[] = await Promise.all(id3tags.artists.map(async (id3Artist) => await this.artistService.createIfNotExists(id3Artist.name, index.mount))) || [];
            song.artists = artists;

            // Save relations
            index.song = song;
            song.index = index;
            await this.songRepository.save(song);
        
            // Request song info on Genius.com
            await this.geniusService.findAndApplySongInfo(song).then(async () => {
                await this.songRepository.save(song);
            });

            // Getting album info
            if(id3tags.album) {
                const album: Album = await this.albumService.createIfNotExists({ title: id3tags.album }, song.artists[0]?.name, song.index.mount);
                song.albums = [ album ];
            }

            // Set status to OK, as this is the last step of the indexing process
            index.status = IndexStatus.OK;
        } catch (error) {
            this.logger.error(error);
            index.status = IndexStatus.ERRORED;
            await this.songRepository.delete({ id: song.id });
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
        const artists: string[] = [];
        if(id3Tags.artist) {
            artists.push(...(id3Tags.artist.split("/") || []))
            for(const index in artists) {
                artists.push(...artists[index].split(","))
                artists.splice(parseInt(index), 1)
            }
        }
        
        // Get artwork buffer
        let artworkBuffer: Buffer = undefined;
        if(id3Tags?.image && id3Tags.image["imageBuffer"]) {
            artworkBuffer = id3Tags.image["imageBuffer"]
        }
    
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
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        // TODO: Sort by "views"?

        // Find song by title or if the artist has similar name
        const result = await this.songRepository.find({
            relations: ["artists", "artwork"],
            join: {
                alias: "song",
                leftJoin: {
                    artists: "song.artists"
                }
            },
            where: qb => {
                qb.where({
                    title: ILike(query)
                })
                .orWhere("artists.name LIKE :query", { query })
            },
            skip: (pageable?.page || 0) * (pageable?.size || 10),
            take: (pageable.size || 10)
        })

        return Page.of(result, result.length, pageable.page);
    }

}
