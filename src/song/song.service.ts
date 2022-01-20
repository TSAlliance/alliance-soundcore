import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import NodeID3 from 'node-id3';

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
import { ILike } from 'typeorm';
import { AlbumService } from '../album/album.service';
import { ArtworkService } from '../artwork/artwork.service';
import { StorageService } from '../storage/storage.service';
import { CreateAlbumDTO } from '../album/dto/create-album.dto';
import { GeniusAlbumDTO } from '../genius/dtos/genius-album.dto';

@Injectable()
export class SongService {
  
    private logger: Logger = new Logger(SongService.name)

    constructor(
        private geniusService: GeniusService,
        private albumService: AlbumService,
        private artworkService: ArtworkService,
        private artistService: ArtistService,
        private storageServie: StorageService,
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
     * Find song by its id.
     * @param songId Song's id
     * @returns Song
     */
     public async findById(songId: string): Promise<Song> {
        return this.songRepository.findOne({ where: { id: songId }})
    }

    /**
     * Find song by its id including its indexed file info.
     * @param songId Song's id
     * @returns Song
     */
    public async findByIdWithIndex(songId: string): Promise<Song> {
        return this.songRepository.findOne({ where: { id: songId }, relations: ["index", "index.mount"]})
    }

    public async findTopSongsByArtist(artistId: string): Promise<Song[]> {
        const result = await this.songRepository.createQueryBuilder('songs')
            // Join for relations
            .leftJoin("songs.artists", "artist")

            // Join to get amount all streams
            .leftJoin('songs.streams', 'streams')

            // Sum up streams and order by highest
            .addSelect('SUM(streams.streamCount)', 'streamCount')
            .groupBy('songs.id')
            .orderBy('streamCount', 'DESC')

            .limit(5)
            .where("artist.id = :artistId", { artistId })
            .getRawAndEntities();

        if(result.entities.length <= 0) throw new NotFoundException("Could not find artist");

        const resultWithRelations = await this.songRepository.createQueryBuilder('songs')
            // Join to fetch artists that are featured
            .leftJoinAndSelect("songs.artists", "allArtists")
            .leftJoinAndSelect("songs.artwork", "artwork")

            .limit(5)
            .where("songs.id IN(:artistIds)", { artistIds: result.entities.map((s) => s.id) })
            .getMany();

        const songs = result.entities.map((song, index) => {
            const songRelations = resultWithRelations.find((s) => s.id == song.id);

            song.artwork = songRelations?.artwork
            song.artists = songRelations?.artists;
            song.streamCount = result.raw[index].streamCount

            return song;
        });

        return songs;
    }

    public async findByGenre(genreId: string, pageable: Pageable): Promise<Page<Song>> {
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
    }

    public async findByPlaylist(playlistId: string, pageable: Pageable): Promise<Page<Song>> {
        const result = await this.songRepository.createQueryBuilder("songs")
            .leftJoin("songs.song2playlist", "song2playlist")
            .leftJoin("song2playlist.playlist", "playlist")
            .leftJoinAndSelect("songs.artwork", "artwork")
            .leftJoinAndSelect("songs.artists", "artist")
            .leftJoinAndSelect("songs.albums", "albums")
            .limit(pageable.size || 30)
            .offset(pageable.page * pageable.size)
            .where("playlist.id = :playlistId", { playlistId })
            .addSelect("song2playlist.createdAt", "song2playlist")
            .getRawAndEntities();

        const totalElements = (await this.songRepository.createQueryBuilder("songs")
            .leftJoin("songs.song2playlist", "song2playlist")
            .leftJoin("song2playlist.playlist", "playlist")
            .where("playlist.id = :playlistId", { playlistId })
        .getCount())

        const elements = result.entities.map((song, index) => {
            song.song2playlist = result.raw[index].song2playlist
            return song;
        });

        return Page.of(elements, totalElements, pageable.page);
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
        const song = await this.songRepository.findOne({ where: { title: createSongDto.title }, relations: ["artwork", "index"]})
        if(song) return song;

        return this.songRepository.save(createSongDto);
    }

    /**
     * Create song metadata entry in database extracted from an indexed file.
     * @param index Indexed file to get metadata from
     * @returns Index
     */
    public async createFromIndex(index: Index): Promise<Song> {
        const filepath = this.storageServie.buildFilepath(index);
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

            // There are artists on the id3 tags. Search them on genius
            song.artists = [];
            const artists: Artist[] = await Promise.all(id3tags.artists.map(async (id3Artist) => await this.artistService.createIfNotExists({ name: id3Artist.name, mountForArtworkId: index.mount.id }))) || [];
            song.artists.push(...artists)

            // Save relations
            index.song = song;
            song.index = index;

            await this.songRepository.save(song).catch((reason) => {
                this.logger.error(`Could not save index relations in database for song ${filepath}: `, reason);
            });
        
            // Request song info on Genius.com
            await this.geniusService.findAndApplySongInfo(song).then(async (result) => {
                if(!result) return;

                // If there are no artists till this point, this means, that
                // there were no artists on the id3tags found.
                if(!song.artists) song.artists = [];

                if(song.artists.length <= 0) {
                    // No artists found, get the ones that were found via the genius song search
                    const foundArtists = []

                    if(result.dto?.featured_artists) foundArtists.push(...result.dto.featured_artists)
                    if(result.dto?.primary_artist) foundArtists.push(result.dto.primary_artist)

                    const artists: Artist[] = await Promise.all(foundArtists.filter((artist) => !!artist).map(async (geniusArtist) => await this.artistService.createIfNotExists({ name: geniusArtist.name, geniusId: geniusArtist.id, geniusUrl: geniusArtist.url, description: geniusArtist.description_preview, mountForArtworkId: index.mount.id }))) || [];
                    song.artists.push(...artists)
                }

                // Extract and create albums
                if(!song.albums) song.albums = [];

                let albums: GeniusAlbumDTO[] = [];
                const artistNames: string[] = song.artists.map((artist) => artist.name);

                if(result.dto?.album) albums.push(result.dto.album)
                if(result.dto?.albums) albums.push(...result.dto.albums)

                // Filter out unwanted albums like music compilations
                // Those have a different primary artist.
                albums = albums.filter((album) => artistNames.includes(album.artist.name));

                // Find every album on genius
                for(const album of albums) {
                    await this.albumService.createIfNotExists({
                        geniusId: album.id,
                        mountForArtworkId: song.index.mount.id,
                        artists: song.artists
                    } as CreateAlbumDTO).then(async (result) => {
                        if(result.album) song.albums.push(result.album);
                        if(result.artist) {
                            // Create artist of album if doesnt exist
                            await this.artistService.createIfNotExists({
                                geniusId: result.artist.id,
                                name: result.artist.name,
                                mountForArtworkId: song.index.mount.id
                            }).then((artist) => {
                                // After artist creation, set the artist as the main album's artist.
                                this.albumService.setArtistOfAlbum(result.album, artist).catch(() => {
                                    this.logger.warn(`Failed setting primary artist on album '${result.album.title}' to artist '${result.artist.name}' (Genius)`);
                                });
                            }).catch(() => {
                                this.logger.warn(`Could not create artist for album ${result.album.title}. Failed on artist: ${result.artist.name} (Genius)`);
                            })
                        }

                        // It could be possible, that there was no valid artist returned,
                        // so we will just stick to the first artist in the song's artist list
                        if(result.album && !result.artist && !!song.artists[0]) {
                            // After artist creation, set the artist as the main album's artist.
                            this.albumService.setArtistOfAlbum(result.album, song.artists[0]).catch(() => {
                                this.logger.warn(`Failed setting primary artist on album '${result.album.title}' to artist '${song.artists[0]?.name}'`);
                            });
                        }
                    }).catch(() => {
                        this.logger.warn(`Could not save album metadata fetched from genius.com of file '${filepath}'. Failed on album '${album.name}'.`);
                    })
                }

                // Get album that is connected via id3tags
                if(id3tags.album) {
                    await this.albumService.createIfNotExists({ 
                        title: id3tags.album.includes("feat") ? id3tags.album : id3tags.album.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, ""),
                        mountForArtworkId: song.index.mount.id,
                        artists: song.artists
                    }).then(async (result) => {
                        if(result.album) song.albums.push(result.album);
                        if(result.artist) {
                            // Create artist of album if doesnt exist
                            await this.artistService.createIfNotExists({
                                geniusId: result.artist.id,
                                name: result.artist.name,
                                mountForArtworkId: song.index.mount.id
                            }).then((artist) => {
                                // After artist creation, set the artist as the main album's artist.
                                this.albumService.setArtistOfAlbum(result.album, artist).catch(() => {
                                    this.logger.warn(`Failed setting primary artist on album '${result.album.title}' to artist '${result.artist.name}'`);
                                });
                            }).catch(() => {
                                this.logger.warn(`Could not create artist for album ${result.album.title}. Failed on artist: ${result.artist.name}`);
                            })
                        }

                        // It could be possible, that there was no valid artist returned,
                        // so we will just stick to the first artist in the song's artist list
                        if(result.album && !result.artist && !!song.artists[0]) {
                            // After artist creation, set the artist as the main album's artist.
                            this.albumService.setArtistOfAlbum(result.album, song.artists[0]).catch(() => {
                                this.logger.warn(`Failed setting primary artist on album '${result.album.title}' to artist '${song.artists[0]?.name}'`);
                            });
                        }
                    }).catch(() => {
                        this.logger.warn(`Could not save album metadata extracted from ID3 Tags of file '${filepath}'`);
                    })
                }

                // Save updated song metadata together
                // with artist relations
                await this.songRepository.save(song).catch((reason) => {
                    this.logger.error(`Could not save relations in database for song ${filepath}: `, reason);
                });
            });

            

            // Set status to OK, as this is the last step of the indexing process
            index.status = IndexStatus.OK;
        } catch (error) {
            this.logger.error(error);
            console.error(error)
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
