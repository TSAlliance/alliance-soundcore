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
import { IndexStatus } from '../index/enum/index-status.enum';
import { GeniusService } from '../genius/services/genius.service';
import { Page, Pageable } from 'nestjs-pager';
import { AlbumService } from '../album/album.service';
import { ArtworkService } from '../artwork/artwork.service';
import { StorageService } from '../storage/storage.service';
import path from 'path';
import { User } from '../user/entities/user.entity';
import { IndexReportService } from '../index-report/services/index-report.service';
import { SongAlbumOrder } from './entities/song-order.entity';

@Injectable()
export class SongService {
  
    private logger: Logger = new Logger(SongService.name)

    constructor(
        private geniusService: GeniusService,
        private albumService: AlbumService,
        private artworkService: ArtworkService,
        private artistService: ArtistService,
        private storageServie: StorageService,
        private indexReportService: IndexReportService,
        private songRepository: SongRepository
    ){}

    /**
     * Find page with the 20 latest indexed songs.
     * @returns Page<Song>
     */
    public async findLatestPage(user?: User): Promise<Page<Song>> {
        const MAX_ELEMENTS = 20;
        const result = await this.songRepository.createQueryBuilder("song")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")
            .leftJoin("song.index", "index")

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .addSelect(["artist.id", "artist.name", "index.id"])

            // Pagination
            .skip(0)
            .limit(MAX_ELEMENTS)

            // Order by release
            .orderBy("song.released", "DESC")
            .addOrderBy("song.createdAt", "DESC")

            .where("index.status = :status", { status: IndexStatus.OK })
            .getMany();

        return Page.of(result, MAX_ELEMENTS, 0);
    }

    /**
     * Find page with the oldest songs by their actual release date
     * @returns Page<Song>
     */
    public async findOldestReleasePage(user?: User): Promise<Page<Song>> {
        const MAX_ELEMENTS = 20;
        const result = await this.songRepository.createQueryBuilder("song")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")
            .leftJoin("song.index", "index")

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .addSelect(["artist.id", "artist.name", "index.id"])

            // Pagination
            .skip(0)
            .take(MAX_ELEMENTS)

            // Order by release
            .orderBy("song.released", "ASC")
            .addOrderBy("song.createdAt", "ASC")

            .where("index.status = :status", { status: IndexStatus.OK })
            .getMany();

        return Page.of(result, MAX_ELEMENTS, 0);
    }

    /**
     * Find song by its id.
     * @param songId Song's id
     * @returns Song
     */
    public async findById(songId: string, user?: User): Promise<Song> {
        const qb = this.songRepository.createQueryBuilder("song")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoinAndSelect("song.label", "label")
            .leftJoinAndSelect("song.publisher", "publisher")
            .leftJoinAndSelect("song.distributor", "distributor")
            .leftJoinAndSelect("song.genres", "genre")
            .leftJoinAndSelect("song.artists", "artist")
            .leftJoin("song.albums", "album")
            .leftJoin("song.index", "index")

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .addSelect(["album.id", "album.title", "index.id"])
            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("song.id = :songId", { songId })
            .orWhere("song.slug = :songId", { songId })

        const result = await qb.getOne();
        return result;
    }

    public async findByIdWithArtwork(songId: string) {
        return this.songRepository.findOne({ where: { id: songId }, relations: ["artwork", "artwork.mount"]});
    }

    /**
     * Find song by its id including its indexed file info.
     * @param songId Song's id
     * @returns Song
     */
    public async findByIdWithIndex(songId: string): Promise<Song> {
        return this.songRepository.findOne({ where: { id: songId }, relations: ["index", "index.mount"]})
    }

    /**
     * Find the top 5 songs by stream count by an artist.
     * @param artistId Artist's id
     * @returns Song[]
     */
    public async findTopSongsByArtist(artistId: string, user?: User, pageable?: Pageable): Promise<Page<Song>> {
        const qb = await this.songRepository.createQueryBuilder('song')
            // Join for relations
            .leftJoin("song.artists", "artist")
            .leftJoin("song.artists", "featArtist")
            .leftJoin("song.artwork", "artwork")
            .leftJoin("song.albums", "album")
            .leftJoin("song.likedBy", "likedByAll")
            .leftJoin("song.index", "index")

            // Join to get amount all streams
            .leftJoin('song.streams', 'streams')

            // Sum up streams and order by highest
            .addSelect(["artist.id", "artist.name", "artwork.id", "artwork.accentColor", "index.id", "featArtist.id", "featArtist.name"])

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))
            
            .addSelect('SUM(streams.streamCount)', 'streamCount')
            .addSelect("COUNT(likedByAll.id)", "likedByAllCount")

            .groupBy('song.id')
            .addGroupBy("album.id")
            .addGroupBy("featArtist.id")
            .addGroupBy("artist.id")

            .orderBy('streamCount', 'DESC')
            .addOrderBy('likedByAllCount', "DESC")
            .distinct(true)
            
            // Pagination
            .skip((pageable?.page || 0) * (pageable?.size || 30))
            .take(pageable?.size || 30)

            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("artist.id = :artistId", { artistId: [ artistId ] })
            .orWhere("artist.slug = :artistId", { artistId: [ artistId ] })

            
        const result = await qb.getRawAndEntities();

        result.entities.map((song, index) => {
            song.streamCount = parseInt(result.raw[index].streamCount || 0)
            return song;
        })

        return Page.of(result.entities, 5, 0);
    }

    /**
     * Find page of songs from artist.
     * @param artistId Artist's id to lookup
     * @param pageable Pagination settings
     * @param user Define user, to add stats like hasLiked to each song.
     * @returns Page<Song>
     */
    public async findSongsByArtist(artistId: string, pageable: Pageable, user?: User): Promise<Page<Song>> {
        const qb = await this.songRepository.createQueryBuilder('song')
            // Join for relations
            .leftJoin("song.artists", "artist")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.albums", "album")
            .leftJoin("song.index", "index")
            .leftJoin("song.artists", "featArtist")

            // Join to get amount all streams
            .leftJoin('song.streams', 'streams')

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            // Sum up streams and order by highest
            .addSelect(["featArtist.id", "featArtist.name", "album.id", "album.title", "index.id"])
            .addSelect('SUM(streams.streamCount)', 'streamCount')
            .groupBy('song.id')
            .addGroupBy("album.id")
            .addGroupBy("featArtist.id")
            .addGroupBy("artist.id")

            .orderBy('song.released', 'DESC')
            .addOrderBy("song.createdAt", "DESC")

            // Pagination
            .skip((pageable?.page || 0) * (pageable?.size || 30))
            .take(pageable.size || 30)

            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("artist.id = :artistId", { artistId })
            .orWhere("artist.slug = :artistId", { artistId: [ artistId ] })
            
        const result = await qb.getRawAndEntities();
        const totalElements = await qb.getCount();

        result.entities.map((song, index) => {
            song.streamCount = parseInt(result.raw[index].streamCount || 0)
            return song;
        })

        return Page.of(result.entities, totalElements, pageable.page);
    }

    /**
     * Find page of songs for a genre (and if defined: for an artist in that genre).
     * @param genreId Genre's id
     * @param artistId Artist's id, if you want to get songs of the artist out of that genre.
     * @param pageable Page settings
     * @param user Enables fetching of hasLiked
     * @returns Page<Song>
     */
    public async findByGenreAndOrArtist(genreId: string, artistId?: string, pageable?: Pageable, user?: User): Promise<Page<Song>> {
        let qb = this.songRepository.createQueryBuilder("song")
            .leftJoin("song.genres", "genre")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")
            .leftJoin("song.albums", "album")
            .leftJoin("song.index", "index")

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            // Pagination
            .skip((pageable?.page || 0) * (pageable?.size || 30))
            .take(pageable.size || 30)

            .addSelect(["artist.id", "artist.name", "album.id", "album.title", "index.id"])
            .where("index.status = :status", { status: IndexStatus.OK })
            
        if(genreId) qb = qb.andWhere("genre.id = :genreId", { genreId }).orWhere("genre.slug = :genreId", { genreId })
        if(artistId) qb = qb.andWhere("artist.id = :artistId", { artistId }).orWhere("artist.slug = :artistId", { artistId })

        const result = await qb.getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    /**
     * Find a complete list of songs that belong to a certain album.
     * @param albumId Album's id
     * @returns Page<Song>
     */
    public async findByAlbum(albumId: string, pageable: Pageable, user?: User): Promise<Page<Song>> {
        const qb = this.songRepository.createQueryBuilder("song")
            .leftJoin("song.albums", "album")
            .leftJoin("song.index", "index")
            .leftJoin("song.streams", "streams")
            .leftJoin("song.albumOrders", "orders", "orders.albumId = :albumId", { albumId })
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoinAndSelect("song.artists", "artist")

            .addSelect(["artist.id", "artist.name", "index.id", "index.status"])
            .orderBy("orders.nr", "ASC")

            // Stats like streamCount and if user has liked the song
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))
            .addSelect(['SUM(IFNULL(streams.streamCount, 0)) AS streamCount'])
            .groupBy('song.id')
            .addGroupBy("index.id")

            .addGroupBy("artist.id")
            .addGroupBy("orders.id")

            // Pagination
            .skip((pageable?.page || 0) * (pageable?.size || 10))
            .take(pageable?.size || 10)

            .where("index.status = :status AND (album.id = :albumId OR album.slug = :albumId)", { status: IndexStatus.OK, albumId })

        const result = await qb.getRawAndEntities();
        const totalElements = await qb.getCount();

        return Page.of(result.entities.map((s, i) => {
            s.streamCount = parseInt(result.raw[i].streamCount)
            console.log(s.index.status)

            return s;
        }), totalElements, pageable.page)
    }

    /**
     * Find page of songs out of a user's collection and, if defined, by an artist.
     * @param user User to fetch collection for.
     * @param pageable Page settings.
     * @param artistId Artist's id, to fetch songs from an artist that a user has in his collection.
     * @returns Page<Song>
     */
    public async findByCollectionAndOrArtist(user: User, pageable: Pageable, artistId?: string): Promise<Page<Song>> {
        // TODO: Ignore indexes that are not OK
        // Fetch available elements
        let qb = await this.songRepository.createQueryBuilder('song')
            .leftJoin("song.likedBy", "likedBy")
            .leftJoin("song.index", "index")

            .leftJoin("song.albums", "album")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")

            .addSelect(["index.id", "album.id", "album.title", "artist.id", "artist.name", "likedBy.likedAt AS likedAt"])
            
            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("likedBy.userId = :userId", { userId: user.id })

            .skip(pageable.page * pageable.size)
            .take(pageable.size)
            .orderBy("likedBy.likedAt", "DESC")
        
        // Take artistId into account if it exists
        if(artistId) qb = qb.andWhere("artist.id = :artistId", { artistId });

        // Count available elements
        let countQb = await this.songRepository.createQueryBuilder("song")
            .leftJoin("song.likedBy", "likedBy")
            .leftJoin("song.index", "index")

            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("likedBy.userId = :userId", { userId: user.id })

        // Take artistId into account if it exists
        if(artistId) countQb = countQb.leftJoin("song.artists", "artist").andWhere("artist.id = :artistId", { artistId });
            
        const totalElements = await countQb.getCount();

        // Execute fetch query
        const result = await qb.getRawAndEntities();

        return Page.of(result.entities.map((s, i) => {
            s.likedAt = result.raw[i].likedAt
            s.liked = true
            return s;
        }), totalElements, pageable.page)
    }

    /**
     * Find all songs that are contained in specific playlist.
     * @param playlistId Playlist's id
     * @returns Page<Song>
     */
    public async findByPlaylist(playlistId: string, user?: User, pageable?: Pageable): Promise<Page<Song>> {
        // TODO: Check if user has access to playlist
        const qb = this.songRepository.createQueryBuilder("song")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")
            .leftJoin("song.albums", "album")
            .leftJoin("song.index", "index")
            .leftJoin("song.playlists", "item")
            .leftJoin("item.playlist", "playlist")

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .addSelect(["album.id", "album.title", "album.slug", "index.id", "artist.id", "artist.slug", "artist.name", "item.createdAt", "item.order"])

            .where("index.status = :status AND (playlist.id = :playlistId OR playlist.slug = :playlistId)", { status: IndexStatus.OK, playlistId })
            .orderBy("item.order", "ASC")
            .addOrderBy("item.createdAt", "ASC")

            // This will fetch everything from db and reduces at BE-level
            // Very unoptimized. Should rework pagination (use last entity's id)
            .skip((pageable?.size || 50) * (pageable?.page || 0))
            .take((pageable?.size || 50))

        const result = await qb.getManyAndCount();  
        return Page.of(result[0], result[1], pageable?.page);
    }

    /**
     * Find all songs that are contained in specific playlist.
     * @param playlistId Playlist's id
     * @returns Page<Song>
     */
     public async findIdsByPlaylist(playlistId: string, user?: User): Promise<Page<Song>> {
        // TODO: Check if user has access to playlist
        const qb = this.songRepository.createQueryBuilder("song")
            .leftJoin("song.playlists", "item")
            .leftJoin("item.playlist", "playlist")
            .leftJoin("song.index", "index")

            .orderBy("item.order", "ASC")
            .addOrderBy("item.createdAt", "ASC")

            .where("index.status = :status AND (playlist.id = :playlistId OR playlist.slug = :playlistId)", { status: IndexStatus.OK, playlistId })
            .select(["song.id"])

        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], 0);
    }

    public async findCoverSongsInPlaylist(playlistId: string): Promise<Page<Song>> {
        const qb = this.songRepository.createQueryBuilder("song")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoinAndSelect("artwork.mount", "mount")
            .leftJoin("song.playlists", "item")
            .leftJoin("item.playlist", "playlist")
            .leftJoin("song.index", "index")

            .orderBy("item.order", "ASC")
            .addOrderBy("item.createdAt", "ASC")

            .where("index.status = :status AND (playlist.id = :playlistId OR playlist.slug = :playlistId)", { status: IndexStatus.OK, playlistId })
            .offset(0)
            .limit(4)

        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], 0);
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
     * Create new song entry in database.
     * @param createSongDto Song data to be saved
     * @returns Song
     */
    private async create(createSongDto: CreateSongDTO): Promise<Song> {
        const song = new Song();
        song.title = createSongDto.title;
        song.duration = createSongDto.duration;
        
        return this.songRepository.save(song).catch((error) => {
            this.logger.error(`Could not create song '${createSongDto.title}' in database: `, error)
            return null;
        });
    }

    /**
     * Create song metadata entry in database extracted from an indexed file.
     * @param index Indexed file to get metadata from
     * @returns Index
     */
    public async createFromIndex(index: Index): Promise<Song> {
        const filepath = this.storageServie.buildFilepath(index);
        this.indexReportService.appendInfo(index.report, `Extracting song metadata from file '${filepath}'`);

        if(!fs.existsSync(filepath)) {
            this.indexReportService.appendError(index.report, `Could not find song file '${filepath}'`);
            throw new NotFoundException("Could not find song file");
        }

        const id3tags = await this.readId3Tags(filepath, index);
        let song = null;

        if(index.song) {
            song = index.song;
            song.index = index;
        } else {
            // TODO: Check if there is a song connected to an indexId
            // Maybe the server stopped or crashed during relation saving and did not finish the task
            // correctly somehow. This seems to happen actually.

            // As there is no song on the current index at this point in code, maybe there is a song with exactly that index

            song = await this.create({
                duration: id3tags.duration,
                title: (id3tags.title || path.parse(filepath).name)?.replace(/^[ ]+|[ ]+$/g,'')
            }).catch((error: Error) => {
                this.logger.error(`Could not save index relations in database for song ${filepath}: `, error);
                this.indexReportService.appendError(index.report, `Could not create song: ${error.message}`)
                throw error;
            });

            song.index = index;
            await this.songRepository.save(song).catch((reason) => {
                this.logger.error(`Could not save index relations in database for song ${filepath}: `, reason);
                this.indexReportService.appendError(index.report, `Could not save index relations in database: ${reason.message}`)
                throw reason;
            });
        }

        if(!song) {
            this.indexReportService.appendError(index.report, `Cannot create song entity for file '${filepath}'`);
            throw new NotFoundException("Cannot create song entity.");
        }

        try {           
            // Create artwork
            const artwork = await this.artworkService.createFromIndexAndBuffer(index, id3tags.artwork).catch((error: Error) => {
                this.indexReportService.appendStackTrace(index.report, `Failed creating artwork from ID3Tags: '${error.message}'`, error.stack);
            });
            if(artwork) song.artwork = artwork;

            // If there are artists on id3 tags -> Create them if they do not exist already
            // Otherwise they will be retrieved and added to the song.
            if(!song.artists) song.artists = [];
            if(id3tags.artists && id3tags.artists.length > 0) {
                // Create all artists found on id3tags, but
                // only if they do not exist
                await Promise.all(id3tags.artists.map(async (id3Artist) => {
                    return await this.artistService.createIfNotExists({ name: id3Artist.name, mountForArtworkId: index.mount.id })
                })).then((artists) => {
                    // Filter out duplicates
                    const existing = song.artists.map((artist) => artist.id)
                    song.artists.push(...artists.filter((artist) => !!artist && !existing.includes(artist.id)))
                    this.indexReportService.appendInfo(index.report, `Adding '${song.artists.map((a) => a.name).join(", ")}' as artists to song`);
                }).catch((reason) => {
                    this.indexReportService.appendError(index.report, `Failed adding artist(s) to song: ${reason.message}`);
                });
            }

            // If there is an album title on id3tags, create it if it does not exist already.
            // If it exists, just add it to song.
            if(!song.albums) song.albums = [];
            if(id3tags.album) {

                const album = await this.albumService.createIfNotExists({ title: id3tags.album, artist: song.artists[0], geniusSearchArtists: song.artists, mountForArtworkId: index.mount.id }).then((state) => state.album).catch((reason) => {
                    this.indexReportService.appendError(index.report, `Failed creating album '${id3tags.album}' for song: ${reason.message}`);
                    return null;
                });

                if(album) {
                    const existing = song.albums.map((album) => album.id);
                    if(!existing.includes(album?.id)) {
                        song.albums.push(album);

                        if(!song.albumOrders) song.albumOrders = [];
                        const existsOrder = song.albumOrders.map((order) => order.album.id);
                        if(!existsOrder.includes(album.id)) {
                            const order = new SongAlbumOrder();
                            order.album = album;
                            order.song = song;
                            order.nr = id3tags.orderNr;

                            song.albumOrders.push(order);
                        }
                        
                        this.indexReportService.appendInfo(index.report, `Added song to album '${album.title}'`);
                    }
                }
            }

            // TODO: Make this sync
            await this.geniusService.findAndApplySongInfo(song).then(() => {
                song.hasGeniusLookupFailed = false;
            }).catch((error: Error) => {
                song.hasGeniusLookupFailed = true;
                this.indexReportService.appendError(index.report, `Something went wrong on Genius.com lookup: ${error.message}`);
            })

            // Save relations to database
            await this.songRepository.save(song).catch((reason) => {
                this.logger.error(`Could not save relations in database for song ${filepath}: `, reason);
                this.indexReportService.appendError(index.report, `Could not save relations in database: ${reason.message}`)
            });
        } catch (error) {
            await this.songRepository.delete({ id: song.id });
            throw error;
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
    private async readId3Tags(filepath: string, indexContext: Index): Promise<ID3TagsDTO> {
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

        const result: ID3TagsDTO = {
            title: id3Tags.title,
            duration: durationInSeconds,
            artists: artists.map((name) => ({ name })),
            album: id3Tags.album,
            artwork: artworkBuffer,
            orderNr: parseInt(id3Tags.trackNumber?.split("/")?.[0]) || undefined
        }
    
        const context = {...result};
        context.artwork = undefined
        this.indexReportService.appendInfo(indexContext.report, `Read ID3Tags from file '${filepath}'`, context);
        return result
    }

    /**
     * Execute search query for a song. This looks up songs that match the query.
     * The search includes looking for songs with a specific artist's name.
     * @param query Query string
     * @param pageable Page settings
     * @returns Page<Song>
     */
    public async findBySearchQuery(query: string, pageable: Pageable, user?: User): Promise<Page<Song>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        // TODO: Sort by "views"?

        // Find song by title or if the artist has similar name
        let qb = this.songRepository.createQueryBuilder("song")
            .leftJoin("song.artists", "artist")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.index", "index")

            .addSelect(["artist.id", "artist.name", "artist.slug", "index.id"])

            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("song.title LIKE :query", { query })
            .orWhere("artist.name LIKE :query", { query })

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .offset((pageable?.page || 0) * (pageable?.size || 10))
            .limit(pageable.size || 10)

        if(query == "%") {
            qb = qb.orderBy("rand()");
        }

        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], pageable.page);
    }

}
