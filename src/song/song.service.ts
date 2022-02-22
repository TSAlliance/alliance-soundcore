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
            .loadRelationCountAndMap("song.likesCount", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .addSelect(["artist.id", "artist.name", "index.id"])

            // Pagination
            .skip(0)
            .limit(MAX_ELEMENTS)

            // Order by release
            .orderBy("song.released", "DESC")
            .addOrderBy("song.createdAt", "DESC")

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
            .loadRelationCountAndMap("song.likesCount", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .addSelect(["artist.id", "artist.name", "index.id"])

            // Pagination
            .skip(0)
            .limit(MAX_ELEMENTS)

            // Order by release
            .orderBy("song.released", "ASC")
            .addOrderBy("song.createdAt", "ASC")

            .getMany();

        return Page.of(result, MAX_ELEMENTS, 0);
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
            .loadRelationCountAndMap("song.likesCount", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))
            
            .addSelect('SUM(streams.streamCount)', 'streamCount')
            .addSelect("COUNT(likedByAll.id)", "likedByAllCount")
            .groupBy('song.id')
            .addGroupBy("album.id")
            .addGroupBy("featArtist.id")
            .orderBy('streamCount', 'DESC')
            .addOrderBy('likedByAllCount', "DESC")
            .distinct(true)
            
            // Pagination
            .skip((pageable?.page || 0) * (pageable?.size || 30))
            .take(pageable?.size || 30)

            .where("artist.id = :artistId", { artistId: [ artistId ] })
            
        const result = await qb.getRawAndEntities();

        result.entities.map((song, index) => {
            song.isLiked = song.likesCount > 0;
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
            .leftJoin("song.artwork", "artwork")
            .leftJoin("song.albums", "album")
            .leftJoin("song.index", "index")
            .leftJoin("song.artists", "featArtist")

            // Join to get amount all streams
            .leftJoin('song.streams', 'streams')

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.likesCount", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            // Sum up streams and order by highest
            .select(["song.id", "song.title", "song.duration", "featArtist.id", "featArtist.name", "artwork.id", "artwork.accentColor", "album.id", "album.title", "index.id"])
            .addSelect('SUM(streams.streamCount)', 'streamCount')
            .groupBy('song.id')
            .addGroupBy("album.id")
            .addGroupBy("featArtist.id")
            .orderBy('song.released', 'DESC')
            .addOrderBy("song.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .where("artist.id = :artistId", { artistId })
            
        const result = await qb.getRawAndEntities();
        const totalElements = await qb.getCount();

        result.entities.map((song, index) => {
            song.isLiked = song.likesCount > 0;
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
            .leftJoin("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")
            .leftJoin("song.albums", "album")
            .leftJoin("song.index", "index.id")

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.likesCount", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .select(["song.id", "song.title", "song.duration", "artwork.id", "artwork.accentColor", "artist.id", "artist.name", "album.id", "album.title"])
            
        if(genreId) qb = qb.andWhere("genre.id = :genreId", { genreId })
        if(artistId) qb = qb.andWhere("artist.id = :artistId", { artistId })

        const result = await qb.getManyAndCount();

        return Page.of(result[0].map((s) => {
            s.isLiked = s.likesCount > 0;
            return s;
        }), result[1], pageable.page);
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

            .select(["artist.id", "artist.name", "artwork.id", "artwork.accentColor", "song.id", "song.title", "song.duration", "song.released", "index.id"])
            .orderBy("orders.nr", "ASC")

            // Stats like streamCount and if user has liked the song
            .loadRelationCountAndMap("song.likesCount", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))
            .addSelect(['SUM(IFNULL(streams.streamCount, 0)) AS streamCount'])
            .groupBy('song.id')
            .addGroupBy("artist.id")
            .addGroupBy("orders.id")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 10))
            .limit(pageable?.size || 10)

            .where("album.id = :albumId", { albumId })
            .orWhere("album.slug = :albumId", { albumId })

        const result = await qb.getRawAndEntities();
        const totalElements = await qb.getCount();

        return Page.of(result.entities.map((s, i) => {
            s.streamCount = parseInt(result.raw[i].streamCount)
            s.isLiked = result.entities[i].likesCount > 0

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
        // Fetch available elements
        let qb = await this.songRepository.createQueryBuilder('song')
            .leftJoin("song.likedBy", "likedBy")
            .leftJoin("song.index", "index")

            .leftJoinAndSelect("song.albums", "album")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")

            .select(["song.id", "song.title", "song.duration", "artwork.id", "index.id", "artwork.accentColor", "album.id", "album.title", "artist.id", "artist.name", "likedBy.likedAt AS likedAt"])
            .where("likedBy.userId = :userId", { userId: user.id })

            .offset(pageable.page * pageable.size)
            .limit(pageable.size)
            .orderBy("likedBy.likedAt", "DESC")
        
        // Take artistId into account if it exists
        if(artistId) qb = qb.andWhere("artist.id = :artistId", { artistId });

        // Count available elements
        let countQb = await this.songRepository.createQueryBuilder("song")
            .leftJoin("song.likedBy", "likedBy")
            .where("likedBy.userId = :userId", { userId: user.id })

        // Take artistId into account if it exists
        if(artistId) countQb = countQb.leftJoin("song.artists", "artist").andWhere("artist.id = :artistId", { artistId });
            
        const totalElements = await countQb.getCount();

        // Execute fetch query
        const result = await qb.getRawAndEntities();

        return Page.of(result.entities.map((s, i) => {
            s.likedAt = result.raw[i].likedAt
            s.isLiked = true
            return s;
        }), totalElements, pageable.page)
    }

    /**
     * Find all songs that are contained in specific playlist.
     * @param playlistId Playlist's id
     * @returns Page<Song>
     */
    public async findByPlaylist(playlistId: string, user?: User, pageable?: Pageable): Promise<Page<Song>> {
        const qb = this.songRepository.createQueryBuilder("song")
            .leftJoin("song.song2playlist", "song2playlist")
            .leftJoin("song2playlist.playlist", "playlist")
            .leftJoin("song.index", "index")
            .leftJoinAndSelect("song.artwork", "artwork")
            .leftJoinAndSelect("song.artists", "artist")
            .leftJoinAndSelect("song.albums", "albums")

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.likesCount", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .where("playlist.id = :playlistId", { playlistId })
            .select(["song.id", "song.title", "song.duration", "artwork.id", "artwork.accentColor", "artist.id", "artist.name", "albums.id", "albums.title", "index.id"])
            .addSelect("song2playlist.createdAt", "song2playlist")

            .skip((pageable?.page || 0) * (pageable?.size || 50))
            .take(pageable.size || 50)

        const result = await qb.getRawAndEntities();
        const totalElements = await qb.getCount();

        const elements = result.entities.map((song, index) => {
            song.song2playlist = result.raw[index].song2playlist
            song.isLiked = result.entities[index].likesCount > 0
            return song;
        });

        return Page.of(elements, totalElements, pageable?.page);
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

    public async findByTitleAndAlbum(title: string, albums: string[]): Promise<Song> {
        return this.songRepository.createQueryBuilder("song")
            .leftJoin("song.albums", "albums")
            .where("albums.title IN(:titles)", { titles: albums })
            .andWhere("song.title = :title", { title })
            .getOne()
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

        console.log("creating song db entry")
        
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
            song = await this.create({
                duration: id3tags.duration,
                title: (id3tags.title || path.parse(filepath).name)?.replace(/^[ ]+|[ ]+$/g,'')
            });

            song.index = index;
            index.song = song;

            console.log("saving index <-> song relation")
            await this.songRepository.save(song).catch((reason) => {
                this.logger.error(`Could not save index relations in database for song ${filepath}: `, reason);
                this.indexReportService.appendError(index.report, `Could not save index relations in database: ${reason.message}`)
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
                console.log("creating artists")
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
                console.log("creating albums")

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

            console.log("preparing genius search")
            await this.geniusService.findAndApplySongInfo(song).then(() => {
                song.hasGeniusLookupFailed = false;
            }).catch((error: Error) => {
                song.hasGeniusLookupFailed = true;
                this.indexReportService.appendError(index.report, `Something went wrong on Genius.com lookup: ${error.message}`);
            })

            // Save relations to database
            console.log("saving final relations")
            await this.songRepository.save(song).catch((reason) => {
                this.logger.error(`Could not save relations in database for song ${filepath}: `, reason);
                this.indexReportService.appendError(index.report, `Could not save relations in database: ${reason.message}`)
            });

            // Set status to OK, as this is the last step of the indexing process
            console.log("done")
            index.status = IndexStatus.OK;
        
            // Request song info on Genius.com
            /*await this.geniusService.findAndApplySongInfo(song).then(async (result) => {
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

                                // TODO: If no artist present, take the artist that was found either on the song or on this album
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
                            // TODO: If no artist present, take the artist that was found either on the song or on this album
                            this.albumService.setArtistOfAlbum(result.album, song.artists[0]).catch(() => {
                                this.logger.warn(`Failed setting primary artist on album '${result.album.title}' to artist '${song.artists[0]?.name}'`);
                            });
                        }
                    }).catch(() => {
                        this.logger.warn(`Could not save album metadata extracted from ID3 Tags of file '${filepath}'`);
                    })
                }

                // Sort out duplicates
                song.albums = [...new Map(song.albums.map(a => [a.id, a])).values()]

                const existsInOneAlbum = await this.findByTitleAndAlbum(song.title, song.albums.map((a) => a.title));
                if(!!existsInOneAlbum) {
                    // Duplicate song in album
                    this.logger.warn("Found duplicate song in one album: " + existsInOneAlbum.title + " albums: " + song.albums.map((a) => a.title).join(", "))

                    index.status = IndexStatus.DUPLICATE;
                } else {
                    // Save updated song metadata together
                    // with artist relations
                    await this.songRepository.save(song).catch((reason) => {
                        this.logger.error(`Could not save relations in database for song ${filepath}: `, reason);
                    });

                    // Set status to OK, as this is the last step of the indexing process
                    index.status = IndexStatus.OK;
                }

                
            });*/
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
    private async readId3Tags(filepath: string, indexContext: Index): Promise<ID3TagsDTO> {
        console.log("reading id3 tags")
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
        console.log("result: ", context)
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
            .leftJoin("song.artwork", "artwork")
            .leftJoin("song.index", "index")

            .addSelect(["artist.id", "artist.name", "artist.slug", "artwork.id", "artwork.accentColor", "index.id"])

            .where("song.title LIKE :query", { query })
            .orWhere("artist.name LIKE :query", { query })

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("song.likesCount", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: user?.id }))

            .offset((pageable?.page || 0) * (pageable?.size || 10))
            .limit(pageable.size || 10)

        if(query == "%") {
            qb = qb.orderBy("rand()");
        }

        const result = await qb.getManyAndCount();
        return Page.of(result[0].map((s) => {
            s.isLiked = s.likesCount > 0;
            return s;
        }), result[1], pageable.page);
    }

}
