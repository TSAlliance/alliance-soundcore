import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { Repository } from 'typeorm';
import { Artist } from '../artist/entities/artist.entity';
import { RedlockError } from '../exceptions/redlock.exception';
import { User } from '../user/entities/user.entity';
import { GeniusFlag, ResourceFlag } from '../utils/entities/resource';
import { CreateResult } from '../utils/results/creation.result';
import { RedisLockableService } from '../utils/services/redis-lockable.service';
import { CreateAlbumDTO } from './dto/create-album.dto';
import { Album } from './entities/album.entity';

@Injectable()
export class AlbumService extends RedisLockableService {
    private readonly logger: Logger = new Logger(AlbumService.name);

    constructor(
        @InjectRepository(Album) private readonly repository: Repository<Album>,
        private readonly eventEmitter: EventEmitter2
    ) {
        super()
    }

    public async findProfilesByArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.repository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoin("album.primaryArtist", "primaryArtist")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "primaryArtist.id", "primaryArtist.name"])
            .where("primaryArtist.id = :artistId", { artistId })
            .orWhere("primaryArtist.slug = :artistId", { artistId })

            .orderBy("album.releasedAt", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findFeaturedWithArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        /*const result = await this.repository.createQueryBuilder("album")
            .leftJoin("album.artwork", "artwork")
            .leftJoin("album.primaryArtist", "primaryArtist")
            .leftJoin("album.songs", "song")
            .leftJoin("song.artists", "featuredArtist", "featuredArtist.id != primaryArtist.id AND (featuredArtist.id = :featArtistId OR featuredArtist.slug = :featArtistId)", { featArtistId: artistId })

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "artwork.accentColor", "primaryArtist.id", "primaryArtist.name", "featuredArtist.id", "featuredArtist.name"])

            .where("featuredArtist.id = :featArtistId OR featuredArtist.slug = :slug", { featArtistId: artistId, slug: artistId })
            .orderBy("album.releasedAt", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .getManyAndCount();     */   

            // TODO
        return Page.of([], 0, pageable.page);
    }

    public async findRecommendedProfilesByArtist(artistId: string, exceptAlbumIds: string | string[] = [], authentication?: User): Promise<Page<Album>> {
        if(!exceptAlbumIds) exceptAlbumIds = []
        if(!Array.isArray(exceptAlbumIds)) {
            exceptAlbumIds = [ exceptAlbumIds ];
        }

        let qb = await this.repository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoinAndSelect("album.primaryArtist", "primaryArtist")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["primaryArtist.id", "primaryArtist.name"])
            .limit(10);

        if(exceptAlbumIds && exceptAlbumIds.length > 0) {
            qb = qb.where("album.id NOT IN(:except)", { except: exceptAlbumIds || [] })
        }
        qb = qb.andWhere("(primaryArtist.id = :artistId OR primaryArtist.slug = :artistId)", { artistId })

        const result = await qb.getMany();
        return Page.of(result, 10, 0);
    }

    public async findByGenre(genreId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.repository.createQueryBuilder("album")
            .leftJoin("album.primaryArtist", "primaryArtist")
            .leftJoin("album.artwork", "artwork")
            .leftJoin("album.songs", "song")
            .leftJoin("song.genres", "genre")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "primaryArtist.id", "primaryArtist.name"])

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
                .leftJoinAndSelect("album.distributor", "distributor")
                .leftJoinAndSelect("distributor.artwork", "distrArtwork")
                .leftJoinAndSelect("album.label", "label")
                .leftJoinAndSelect("label.artwork", "labelArtwork")
                .leftJoinAndSelect("album.publisher", "publisher")
                .leftJoinAndSelect("publisher.artwork", "publisherArtwork")
                .leftJoinAndSelect("album.primaryArtist", "primaryArtist")
                .leftJoinAndSelect("primaryArtist.artwork", "albumArtwork")

                .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

                .groupBy("album.id")

                // Counting the songs
                .addSelect('COUNT(song.id)', 'songsCount')

                // SUM up the duration of every song to get total duration of the playlist
                .addSelect('SUM(song.duration)', 'totalDuration')
                .getRawAndEntities()

        const album = result.entities[0];
        if(!album) throw new NotFoundException("Album not found.")

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
     public async createIfNotExists(createAlbumDto: CreateAlbumDTO, waitForLock = false): Promise<CreateResult<Album>> {
        createAlbumDto.name = createAlbumDto.name?.trim();

        // Acquire lock
        return this.lock(createAlbumDto.name, async (signal) => {
            const existingAlbum = await this.findByNameAndArtist(createAlbumDto.name, createAlbumDto.primaryArtist);
            if(existingAlbum) return new CreateResult(existingAlbum, true); 
            if(signal.aborted) throw new RedlockError();

            const album = new Album();
            album.name = createAlbumDto.name;
            album.description = createAlbumDto.description;
            album.releasedAt = createAlbumDto.releasedAt;
            album.primaryArtist = createAlbumDto.primaryArtist;

            return this.repository.save(album).then((result) => {
                return new CreateResult(result, false);
            })
        }, waitForLock).catch((error: Error) => {
            this.logger.error(`Failed creating album: ${error.message}`, error.stack);
            throw new InternalServerErrorException();
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
            .leftJoin("album.primaryArtist", "primaryArtist")

            .limit(pageable.size)
            .offset(pageable.page * pageable.size)

            .addSelect(["primaryArtist.id", "primaryArtist.name", "primaryArtist.slug"])
            .where("album.title LIKE :query", { query });

        if(query == "%") {
            qb = qb.orderBy("rand()");
        }

        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], pageable.page);
    }

    

}
