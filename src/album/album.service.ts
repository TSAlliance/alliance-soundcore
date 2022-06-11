import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Page, Pageable } from 'nestjs-pager';
import { Artist } from '../artist/entities/artist.entity';
import { EVENT_ALBUM_CREATED } from '../constants';
import { AlbumCreatedEvent } from '../events/albumCreated.event';
import { RedlockError } from '../exceptions/redlock.exception';
import { Mount } from '../mount/entities/mount.entity';
import { User } from '../user/entities/user.entity';
import { GeniusFlag, ResourceFlag } from '../utils/entities/resource';
import { RedisLockableService } from '../utils/services/redis-lockable.service';
import { CreateAlbumDTO } from './dto/create-album.dto';
import { Album } from './entities/album.entity';
import { AlbumRepository } from './repositories/album.repository';

@Injectable()
export class AlbumService extends RedisLockableService {
    private readonly logger: Logger = new Logger(AlbumService.name);

    constructor(
        private readonly repository: AlbumRepository,
        private readonly eventEmitter: EventEmitter2
    ) {
        super()
    }

    public async findProfilesByArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.repository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoinAndSelect("album.banner", "banner")
            .leftJoin("album.artist", "artist")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "artwork.accentColor", "banner.id", "banner.accentColor", "artist.id", "artist.name"])
            .where("artist.id = :artistId", { artistId })
            .orWhere("artist.slug = :artistId", { artistId })

            .orderBy("album.released", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findFeaturedWithArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.repository.createQueryBuilder("album")
            .leftJoin("album.artwork", "artwork")
            .leftJoin("album.banner", "banner")
            .leftJoin("album.artist", "artist")
            .leftJoin("album.songs", "song")
            .leftJoin("song.artists", "featuredArtist", "featuredArtist.id != artist.id AND (featuredArtist.id = :featArtistId OR featuredArtist.slug = :featArtistId)", { featArtistId: artistId })

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "artwork.accentColor", "banner.id", "banner.accentColor", "artist.id", "artist.name", "featuredArtist.id", "featuredArtist.name"])

            .where("featuredArtist.id = :featArtistId OR featuredArtist.slug = :slug", { featArtistId: artistId, slug: artistId })
            .orderBy("album.released", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .getManyAndCount();        

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findRecommendedProfilesByArtist(artistId: string, exceptAlbumIds: string | string[] = [], authentication?: User): Promise<Page<Album>> {
        if(!exceptAlbumIds) exceptAlbumIds = []
        if(!Array.isArray(exceptAlbumIds)) {
            exceptAlbumIds = [ exceptAlbumIds ];
        }

        let qb = await this.repository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoinAndSelect("album.banner", "banner")
            .leftJoinAndSelect("album.artist", "artist")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artist.id", "artist.name"])
            .limit(10);

        if(exceptAlbumIds && exceptAlbumIds.length > 0) {
            qb = qb.where("album.id NOT IN(:except)", { except: exceptAlbumIds || [] })
        }
        qb = qb.andWhere("(artist.id = :artistId OR artist.slug = :artistId)", { artistId })

        const result = await qb.getMany();
        return Page.of(result, 10, 0);
    }

    public async findByGenre(genreId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.repository.createQueryBuilder("album")
            .leftJoin("album.artist", "artist")
            .leftJoin("album.artwork", "artwork")
            .leftJoin("album.songs", "song")
            .leftJoin("song.genres", "genre")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "artwork.accentColor", "artist.id", "artist.name"])

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .where("genre.id = :genreId OR genre.slug = :genreId", { genreId })
            .getMany()

        return Page.of(result, result.length, pageable.page);
    }

    /**
     * Find album by its id including all information required to display the album
     * page on the frontend
     * @param albumId Album's id
     * @returns Album
     */
    public async findProfileById(albumId: string, authentication?: User): Promise<Album> {
        const result = await this.repository.createQueryBuilder("album")
                .where("album.id = :albumId", { albumId })
                .orWhere("album.slug = :albumId", { albumId })

                // Relation for counting and summing up duration
                .leftJoin("album.songs", "song")
                
                // This is for relations
                .leftJoinAndSelect("album.artwork", "artwork")
                .leftJoinAndSelect("album.banner", "banner")
                .leftJoinAndSelect("album.distributor", "distributor")
                .leftJoinAndSelect("distributor.artwork", "distrArtwork")
                .leftJoinAndSelect("album.label", "label")
                .leftJoinAndSelect("label.artwork", "labelArtwork")
                .leftJoinAndSelect("album.publisher", "publisher")
                .leftJoinAndSelect("publisher.artwork", "publisherArtwork")
                .leftJoinAndSelect("album.artist", "artist")
                .leftJoinAndSelect("artist.artwork", "albumArtwork")

                .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

                .groupBy("album.id")

                // Counting the songs
                .addSelect('COUNT(song.id)', 'songsCount')

                // SUM up the duration of every song to get total duration of the playlist
                .addSelect('SUM(song.duration)', 'totalDuration')
                .getRawAndEntities()

        const album = result.entities[0];
        if(!album) throw new NotFoundException("Album not found.")

        const featuredArtists = await this.repository.createQueryBuilder("album")
            .where("album.id = :albumId", { albumId })
            .orWhere("album.slug = :albumId", { albumId })
            .andWhere("artist.id != :artistId", { artistId: album.primaryArtist?.id })

            .leftJoin("album.songs", "song")
            .leftJoinAndSelect("song.artists", "artist")
            .leftJoinAndSelect("artist.artwork", "artwork")
            
            .select(["artist.id", "artist.name", "artwork.id", "artwork.accentColor"])
            .distinct()
            .getRawAndEntities()

        /*album.featuredArtists = featuredArtists.raw.map((a) => ({
            id: a.artist_id,
            name: a.artist_name,
            artwork: {
                id: a.artwork_id,
                accentColor: a.artwork_accentColor
            }
        } as Artist))*/

        album.totalDuration = parseInt(result.raw[0].totalDuration);
        album.songsCount = parseInt(result.raw[0].songsCount)

        return album
    }

    /**
     * Find an album by its titel that also has a specific primary artist.
     * @param name name of the album to lookup
     * @param primaryArtist Primary album artist
     * @returns Album
     */
    public async findByNameAndArtist(name: string, primaryArtist: Artist): Promise<Album> {
        return await this.repository.createQueryBuilder("album")
            .leftJoinAndSelect("album.primaryArtist", "primaryArtist")
            .where("album.name = :name AND primaryArtist.id = :primaryArtistId", { name, primaryArtistId: primaryArtist?.id })
            .getOne();
    }

    /**
     * Save an album entity.
     * @param album Entity data to be saved
     * @returns Album
     */
    public async save(album: Album): Promise<Album> {
        return this.repository.save(album);
    }

    /**
     * Create an album if not exists.
     * @param createAlbumDto Data to create album from
     * @returns Album
     */
     public async createIfNotExists(createAlbumDto: CreateAlbumDTO, useMount: Mount): Promise<{ album: Album, existed: boolean }> {
        createAlbumDto.name = createAlbumDto.name?.replace(/^[ ]+|[ ]+$/g,'').trim();

        // Acquire lock
        return this.lock(createAlbumDto.name, async (signal) => {
            const existingAlbum = await this.findByNameAndArtist(createAlbumDto.name, createAlbumDto.primaryArtist);
            if(existingAlbum) return { album: existingAlbum, existed: true }; 
            if(signal.aborted) throw new RedlockError();

            const album = new Album();
            album.name = createAlbumDto.name;
            album.description = createAlbumDto.description;
            album.releasedAt = createAlbumDto.releasedAt;
            album.primaryArtist = createAlbumDto.primaryArtist;

            return this.repository.save(album).then(async (result) => {
                // If genius lookup is triggered on creation,
                // emit event for the genius service to catch
                // the album and trigger the lookup.
                if(createAlbumDto.lookupGenius) this.eventEmitter.emit(EVENT_ALBUM_CREATED, new AlbumCreatedEvent(result, useMount));
                return { album: result, existed: false };
            }).catch(async (error) => {
                throw error;
            });
        })
    }

    /**
     * Set the primary artist of an album.
     * @param idOrObject Id or album object
     * @param primaryArtist Updated primary artist
     * @returns Album
     */
    public async setPrimaryArtist(idOrObject: string | Album, primaryArtist: Artist): Promise<Album> {
        const album = await this.resolveAlbum(idOrObject);
        if(!album) throw new NotFoundException("Album not found.");

        album.primaryArtist = primaryArtist;
        return this.repository.save(album);
    }

    /**
     * Set resource flag of an album.
     * @param idOrObject Album id or object
     * @param flag Resource flag
     * @returns Album
     */
    public async setFlag(idOrObject: string | Album, flag: ResourceFlag): Promise<Album> {
        const artist = await this.resolveAlbum(idOrObject);
        if(!artist) throw new NotFoundException("Artist not found.");

        artist.flag = flag;
        return this.repository.save(artist);
    }

    /**
     * Set resource flag of an Album.
     * @param idOrObject Album id or object
     * @param flag Genius flag
     * @returns Album
     */
    public async setGeniusFlag(idOrObject: string | Album, flag: GeniusFlag): Promise<Album> {
        const album = await this.resolveAlbum(idOrObject);
        if(!album) throw new NotFoundException("Album not found.");

        album.geniusFlag = flag;
        return this.repository.save(album);
    }

    /**
     * Find album by its id or object itself.
     * @param idOrObject Id or album object
     * @returns Album
     */
    private async resolveAlbum(idOrObject: string | Album): Promise<Album> {
        if(typeof idOrObject == "string") {
            return this.findProfileById(idOrObject);
        }

        return idOrObject;
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Album>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        let qb = this.repository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoin("album.artist", "artist")

            .limit(pageable.size)
            .offset(pageable.page * pageable.size)

            .addSelect(["artist.id", "artist.name", "artist.slug"])
            .where("album.title LIKE :query", { query });

        if(query == "%") {
            qb = qb.orderBy("rand()");
        }

        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], pageable.page);
    }

    

}
