import fs from "fs";
import NodeID3 from "node-id3";
import ffprobe from 'ffprobe';
import ffprobeStatic from "ffprobe-static";

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateSongDTO } from './dtos/create-song.dto';
import { Song } from './entities/song.entity';
import { SongRepository } from './repositories/song.repository';
import { IndexStatus } from '../index/enum/index-status.enum';
import { Page, Pageable } from 'nestjs-pager';
import { User } from '../user/entities/user.entity';
import { Artwork } from '../artwork/entities/artwork.entity';
import { SongUniqueFindDTO } from "./dtos/unique-find.dto";
import { GeniusFlag, ResourceFlag } from "../utils/entities/resource";
import { ID3TagsDTO } from "./dtos/id3-tags.dto";
import { RedisLockableService } from "../utils/services/redis-lockable.service";
import { RedlockError } from "../exceptions/redlock.exception";

@Injectable()
export class SongService extends RedisLockableService {
    private readonly logger: Logger = new Logger(SongService.name)

    constructor(
        private readonly repository: SongRepository
    ){
        super();
    }

    /**
     * Find page with the 20 latest indexed songs.
     * @returns Page<Song>
     */
    public async findLatestPage(user?: User): Promise<Page<Song>> {
        const MAX_ELEMENTS = 20;
        const result = await this.repository.createQueryBuilder("song")
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
        const result = await this.repository.createQueryBuilder("song")
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
        const qb = this.repository.createQueryBuilder("song")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoinAndSelect("song.label", "label")
            .leftJoinAndSelect("song.publisher", "publisher")
            .leftJoinAndSelect("song.distributor", "distributor")
            .leftJoinAndSelect("song.genres", "genre")
            .leftJoinAndSelect("song.artists", "artist")
            .leftJoinAndSelect("artist.artwork", "artistArtwork")
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
        return this.repository.findOne({ where: { id: songId }, relations: ["artwork", "artwork.mount"]});
    }

    public async findByTitleAndArtists(title: string, artists: string[]) {
        const result = await this.repository.createQueryBuilder("song")
            .leftJoin("song.artists", "artist")
            .where("song.title = :title AND artist.name IN(:artists)", { title, artists })
            .select(["song.id"])
            .getOne();

        return result;
    }

    /**
     * Find song by its id including its indexed file info.
     * @param songId Song's id
     * @returns Song
     */
    public async findByIdWithIndex(songId: string): Promise<Song> {
        return this.repository.findOne({ where: { id: songId }, relations: ["index", "index.mount"]})
    }

    /**
     * Find the top 5 songs by stream count by an artist.
     * @param artistId Artist's id
     * @returns Song[]
     */
    public async findTopSongsByArtist(artistId: string, user?: User, pageable?: Pageable): Promise<Page<Song>> {
        const qb = await this.repository.createQueryBuilder('song')
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

        return Page.of(result.entities, result.entities.length, 0);
    }
    /**
     * Find the top 5 songs by stream count by an artist.
     * @param artistId Artist's id
     * @returns Song[]
     */
     public async findTopSongsIdsByArtist(artistId: string): Promise<Page<Song>> {
        const qb = await this.repository.createQueryBuilder('song')
            // Join for relations
            .leftJoin("song.likedBy", "likedByAll")
            .leftJoin("song.index", "index")
            .leftJoin("song.artists", "artist")

            // Join to get amount all streams
            .leftJoin('song.streams', 'streams')

            .select(["song.id"])
            .addSelect('SUM(streams.streamCount)', 'streamCount')
            .addSelect("COUNT(likedByAll.id)", "likedByAllCount")

            .groupBy("song.id")

            .orderBy('streamCount', 'DESC')
            .addOrderBy('likedByAllCount', "DESC")
            .distinct(true)
            
            // Pagination
            .limit(5)

            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("artist.id = :artistId", { artistId: [ artistId ] })
            .orWhere("artist.slug = :artistId", { artistId: [ artistId ] })
            
            
        const result = await qb.getMany();
        return Page.of(result, result.length, 0);
    }

    /**
     * Find page of songs from artist.
     * @param artistId Artist's id to lookup
     * @param pageable Pagination settings
     * @param user Define user, to add stats like hasLiked to each song.
     * @returns Page<Song>
     */
    public async findSongsByArtist(artistId: string, pageable: Pageable, user?: User): Promise<Page<Song>> {
        const qb = await this.repository.createQueryBuilder('song')
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
     * Find page of songs from artist.
     * @param artistId Artist's id to lookup
     * @returns Page<Song>
     */
     public async findIdsByArtist(artistId: string): Promise<Page<Song>> {
        const qb = await this.repository.createQueryBuilder('song')
            // Join for relations
            .leftJoin("song.artists", "artist")
            .leftJoin("song.index", "index")

            .orderBy('song.released', 'DESC')
            .addOrderBy("song.createdAt", "DESC")

            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("artist.id = :artistId", { artistId })
            .orWhere("artist.slug = :artistId", { artistId: [ artistId ] })
            .select(["song.id"])
            
        const result = await qb.getMany();
        return Page.of(result, result.length, 0);
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
        let qb = this.repository.createQueryBuilder("song")
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
            
            
        if(genreId) qb = qb.where("index.status = :status AND (genre.id = :genreId OR genre.slug) = :genreId", { status: IndexStatus.OK, genreId })
        if(artistId) qb = qb.where("index.status = :status AND (artist.id = :artistId OR artist.slug) = :artistId", { status: IndexStatus.OK, artistId })

        const result = await qb.getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    /**
     * Find a complete list of songs that belong to a certain album.
     * @param albumId Album's id
     * @returns Page<Song>
     */
    public async findByAlbum(albumId: string, pageable: Pageable, user?: User): Promise<Page<Song>> {
        const qb = this.repository.createQueryBuilder("song")
            .leftJoin("song.artists", "artist")
            .leftJoin("song.albums", "album")
            .leftJoin("song.index", "index")
            .leftJoin("song.streams", "streams")
            .leftJoin("song.albumOrders", "order", "order.albumId = :albumId", { albumId })
            .leftJoinAndSelect("song.artwork", "artwork")

            // Stats like streamCount and if user has liked the song
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))
            
            .groupBy('song.id')
            .addGroupBy("index.id")
            .addGroupBy("artist.id")
            .addGroupBy("order.id")

            // Pagination
            .skip((pageable?.page || 0) * (pageable?.size || 10))
            .take(pageable?.size || 10)

            .addSelect(["artist.id", "artist.name", "index.id", "index.status", "order.nr", "SUM(IFNULL(streams.streamCount, 0)) AS streamCount"])
            .where("index.status = :status AND (album.id = :albumId OR album.slug = :albumId)", { status: IndexStatus.OK, albumId })
            .orderBy("order.nr", "ASC")

        const result = await qb.getRawAndEntities();
        const totalElements = await qb.getCount();

        return Page.of(result.entities.map((s, i) => {
            s.streamCount = parseInt(result.raw[i].streamCount)
            return s;
        }), totalElements, pageable.page)
    }

    /**
     * Find a complete list of songs that belong to a certain album.
     * @param albumId Album's id
     * @returns Page<Song>
     */
    public async findIdsByAlbum(albumId: string): Promise<Page<Song>> {
        const qb = this.repository.createQueryBuilder("song")
            .leftJoin("song.index", "index")
            .leftJoin("song.albums", "album")

            .leftJoin("song.albumOrders", "order", "order.albumId = :albumId", { albumId })

            .select(["song.id"])
            .where("index.status = :status AND (album.id = :albumId OR album.slug = :albumId)", { status: IndexStatus.OK, albumId })
            .orderBy("order.nr", "ASC")

        const result = await qb.getMany();
        return Page.of(result, result.length, 0)
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
        let qb = await this.repository.createQueryBuilder('song')
            .leftJoin("song.likedBy", "likedBy")
            .leftJoin("song.index", "index")

            .leftJoin("song.albums", "album")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")

            .addSelect(["index.id", "album.id", "album.title", "artist.id", "artist.name", "likedBy.likedAt"])
            
            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("likedBy.userId = :userId", { userId: user?.id })

            .skip(pageable.page * pageable.size)
            .take(pageable.size)
            .orderBy("likedBy.likedAt", "DESC")
        
        // Take artistId into account if it exists
        if(artistId) qb = qb.andWhere("artist.id = :artistId", { artistId });

        // Count available elements
        let countQb = await this.repository.createQueryBuilder("song")
            .leftJoin("song.likedBy", "likedBy")
            .leftJoin("song.index", "index")

            .where("index.status = :status", { status: IndexStatus.OK })
            .andWhere("likedBy.userId = :userId", { userId: user?.id })

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
     * Find page of songs out of a user's collection and, if defined, by an artist.
     * @param user User to fetch collection for.
     * @param pageable Page settings.
     * @param artistId Artist's id, to fetch songs from an artist that a user has in his collection.
     * @returns Page<Song>
     */
    public async findIdsByCollection(user: User, artistId?: string): Promise<Page<Song>> {
        // Fetch available elements
        let qb = this.repository.createQueryBuilder('song')
            .leftJoin("song.index", "index")
            .leftJoin("song.likedBy", "likedBy")
            .where("index.status = :status AND likedBy.userId = :userId", { status: IndexStatus.OK, userId: user?.id })
            .orderBy("likedBy.likedAt", "DESC")
            .select(["song.id"])
            
        if(artistId) qb = qb.leftJoin("song.artists", "artist").andWhere("artist.id = :artistId", { artistId })
        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], 0)
    }

    /**
     * Find all songs that are contained in specific playlist.
     * @param playlistId Playlist's id
     * @returns Page<Song>
     */
    public async findByPlaylist(playlistId: string, user?: User, pageable?: Pageable): Promise<Page<Song>> {
        // TODO: Check if user has access to playlist
        const qb = this.repository.createQueryBuilder("song")
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
        const qb = this.repository.createQueryBuilder("song")
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
        const qb = this.repository.createQueryBuilder("song")
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
        return this.repository.findAll(pageable, {
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
     * Save an song entity.
     * @param song Entity data to be saved
     * @returns Song
     */
    public async save(song: Song): Promise<Song> {
        return this.repository.save(song);
    }

    /**
     * Create new song entry in database. If the same entry already exists,
     * the existing one will be returned.
     * Existing song contains following relations: primaryArtist, featuredArtist, album
     * @param createSongDto Song data to be saved
     * @returns [Song, hasExistedBefore]
     */
    public async createIfNotExists(createSongDto: CreateSongDTO): Promise<{ song: Song, existed: boolean }> {
        // Do some validation to be sure there is an existing value
        createSongDto.duration = createSongDto.duration || 0;
        createSongDto.order = createSongDto.order || 0;
        createSongDto.featuredArtists = createSongDto.featuredArtists || [];

        const uniqueDto: SongUniqueFindDTO = {
            name: createSongDto.name,
            duration: createSongDto.duration,
            album: createSongDto.album,
            primaryArtist: createSongDto.primaryArtist,
            featuredArtists: createSongDto.featuredArtists
        }

        const lockName = `${uniqueDto.name}_${uniqueDto.album?.name}_${uniqueDto.duration}_${uniqueDto.primaryArtist?.name}_${uniqueDto.featuredArtists.map((artist) => artist.name).join("-")}`;

        return this.lock(lockName, async (signal) => {
            // Execute find query.
            const existingSong = await this.findUniqueSong(uniqueDto)
            // If song already exists
            if(existingSong) return { song: existingSong, existed: true };
            if(signal.aborted) throw new RedlockError();

            const song = new Song();
            song.name = createSongDto.name;
            song.primaryArtist = createSongDto.primaryArtist;
            song.featuredArtists = createSongDto.featuredArtists;
            song.album = createSongDto.album;
            song.order = createSongDto.order;
            song.duration = createSongDto.duration;
            song.file = createSongDto.file;
            song.artwork = createSongDto.artwork;

            return this.repository.save(song).then(async (result) => {
                return { song: result, existed: false }
            });
        });
    }

    /**
     * Set the artwork of a song.
     * @param idOrObject Id or song object
     * @param artwork Artwork to set
     * @returns Song
     */
    public async setArtwork(idOrObject: string | Song, artwork: Artwork): Promise<Song> {
        const song = await this.resolveSong(idOrObject);
        if(!song) throw new NotFoundException("Could not find song.");

        song.artwork = artwork;
        return this.repository.save(song);
    }

    /**
     * Set the flag of a song.
     * @param idOrObject Id or song object
     * @param flag Flag to set
     * @returns Song
     */
    public async setFlag(idOrObject: string | Song, flag: ResourceFlag): Promise<Song> {
        const song = await this.resolveSong(idOrObject);
        if(!song) throw new NotFoundException("Could not find song.");

        song.flag = flag;
        return this.repository.save(song);
    }

    /**
     * Set the genius flag of a song.
     * @param idOrObject Id or song object
     * @param flag Genius Flag to set
     * @returns Song
     */
    public async setGeniusFlag(idOrObject: string | Song, flag: GeniusFlag): Promise<Song> {
        const song = await this.resolveSong(idOrObject);
        if(!song) throw new NotFoundException("Could not find song.");

        song.geniusFlag = flag;
        return this.repository.save(song);
    }

    /**
     * Set the order in the song's album.
     * @param idOrObject Id or song object
     * @param order Updated album order number
     * @returns Song
     */
    public async setAlbumOrder(idOrObject: string | Song, order: number): Promise<Song> {
        const song = await this.resolveSong(idOrObject);
        if(!song) throw new NotFoundException("Could not find song.");

        song.order = order;
        return this.repository.save(song);
    }

    /**
     * Read ID3Tags from a mp3 file.
     * @param filepath Path to mp3 file
     * @returns ID3TagsDTO
     */
    public async readID3TagsFromFile(filepath: string): Promise<ID3TagsDTO> {
        const id3Tags = NodeID3.read(fs.readFileSync(filepath));

        // Get duration in seconds
        const probe = await ffprobe(filepath, {
            path: ffprobeStatic.path
        })

        const durationInSeconds = Math.round(probe.streams[0].duration || 0);

        // Get artists
        const artists: string[] = [];
        if (id3Tags.artist) {
            artists.push(...(id3Tags.artist.split("/") || []))
            for (const index in artists) {
                artists.push(...artists[index].split(",").map((name) => name.trim()))
                artists.splice(parseInt(index), 1)
            }
        }

        // Get artwork buffer
        let artworkBuffer: Buffer = undefined;
        if (id3Tags?.image && id3Tags.image["imageBuffer"]) {
            artworkBuffer = id3Tags.image["imageBuffer"]
        }

        // Build result DTO
        const result: ID3TagsDTO = {
            title: id3Tags.title.trim(),
            duration: durationInSeconds,
            artists: artists.map((name) => ({
                name
            })),
            album: id3Tags.album.trim(),
            cover: artworkBuffer,
            orderNr: parseInt(id3Tags.trackNumber?.split("/")?.[0]) || null
        }

        return result
    }

    /**
     * Resolve an id or object to song object.
     * @param idOrObject ID of the song or song object.
     * @returns Song
     */
    private async resolveSong(idOrObject: string | Song): Promise<Song> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject as Song;
    }

    /**
     * Find a unique song for certain criterias that are usually used to prove
     * a songs uniqueness.
     * @param uniqueSong Data to prove uniqueness
     * @returns Song
     */
    private async findUniqueSong(uniqueSong: SongUniqueFindDTO): Promise<Song> {
        let query = this.repository.createQueryBuilder("song")
                .leftJoinAndSelect("song.primaryArtist", "primaryArtist")
                .leftJoinAndSelect("song.featuredArtists", "featuredArtist")
                .leftJoinAndSelect("song.album", "album")
                .where("song.name = :name AND album.name = :album AND song.duration = :duration AND primaryArtist.name = :artist", { 
                    name: uniqueSong.name,
                    duration: uniqueSong.duration,
                    album: uniqueSong.album?.name,
                    artist: uniqueSong.primaryArtist?.name
                });

            // Build query to include all featuredArtists in where clause
            const featuredArtists = uniqueSong.featuredArtists.map((artist) => artist.name);
            query = query.andWhere(`featuredArtist.name = '${featuredArtists.join("' OR featuredArtist.name = '")}'`);

            // Execute query.
            return query.getOne();
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
        let qb = this.repository.createQueryBuilder("song")
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
