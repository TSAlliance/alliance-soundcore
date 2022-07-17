import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Artist } from '../artist/entities/artist.entity';
import { EVENT_ALBUM_CHANGED } from '../constants';
import { AlbumChangedEvent } from '../events/album-changed.event';
import { RedlockError } from '../exceptions/redlock.exception';
import { SyncFlag } from '../meilisearch/interfaces/syncable.interface';
import { MeiliAlbumService } from '../meilisearch/services/meili-album.service';
import { User } from '../user/entities/user.entity';
import { GeniusFlag, ResourceFlag } from '../utils/entities/resource';
import { CreateResult } from '../utils/results/creation.result';
import { RedisLockableService } from '../utils/services/redis-lockable.service';
import { CreateAlbumDTO } from './dto/create-album.dto';
import { UpdateAlbumDTO } from './dto/update-album.dto';
import { Album } from './entities/album.entity';

@Injectable()
export class AlbumService extends RedisLockableService {
    private readonly logger: Logger = new Logger(AlbumService.name);

    constructor(
        private readonly meiliAlbum: MeiliAlbumService,
        @InjectRepository(Album) private readonly repository: Repository<Album>,
        private readonly eventEmitter: EventEmitter2
    ) {
        super()
    }

    /**
     * Find album by its id including all information required to display the album
     * page on the frontend
     * @param albumId Album's id
     * @returns Album
     */
     public async findById(albumId: string, authentication?: User): Promise<Album> {
        const result = await this.buildGeneralQuery("album", authentication)
            .addSelect(["artwork.colors"])
            .loadRelationCountAndMap("album.songsCount", "album.songs")

            .leftJoin("album.distributor", "distributor").leftJoin("distributor.artwork", "da").addSelect(["distributor.id", "distributor.slug", "distributor.name", "da.id"])
            .leftJoin("album.publisher", "publisher").leftJoin("publisher.artwork", "da").addSelect(["publisher.id", "publisher.slug", "publisher.name", "da.id"])
            .leftJoin("album.label", "label").leftJoin("label.artwork", "da").addSelect(["label.id", "label.slug", "label.name", "da.id"])
            .leftJoin("primaryArtist.artwork", "artistArtwork").addSelect(["artistArtwork.id"])
            .leftJoin("album.songs", "song").addSelect('SUM(song.duration) as _album_totalDuration')
            
            .groupBy("album.id")
            .where("album.id = :albumId OR album.slug = :albumId", { albumId })
            .getOne();

        return result;
    }

    /**
     * Find albums by an artist
     * @param artistId Artist's id
     * @param pageable Page settings
     * @param authentication Authentication object
     * @returns Page<Album>
     */
    public async findByArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.buildGeneralQuery("album", authentication)
            .skip((pageable?.page || 0) * (pageable?.size || 30))
            .take(pageable.size || 30)

            .orderBy("album.releasedAt", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            .where("primaryArtist.id = :artistId OR primaryArtist.slug = :artistId", { artistId })
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    /**
     * Find albums where a special artist is featured in.
     * This looksup songs where the artist might be primary or featured artist
     * inside an album.
     * @param artistId Artist's id
     * @param pageable Page settings
     * @param authentication Authentication object
     * @returns Page<Album>
     */
    public async findFeaturedWithArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.buildGeneralQuery("album", authentication)
            .leftJoin("album.songs", "song")
            .leftJoin("song.primaryArtist", "songArtist")
            .leftJoin("song.featuredArtists", "songFeatArtist")

            .skip((pageable?.page || 0) * (pageable?.size || 30))
            .take(pageable.size || 30)

            .orderBy("album.releasedAt", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            .where("songArtist.id = :artistId OR songArtist.slug = :artistId OR songFeatArtist.id = :artistId OR songFeatArtist.slug = :artistId", { artistId })
            .getManyAndCount();
        
        return Page.of(result[0], result[1], pageable.page);
    }

    /**
     * Find 10 recommendation of albums by an artist.
     * @param artistId Artist's id
     * @param exceptAlbumIds Exclude album ids
     * @param authentication Authentication object
     * @returns Page<Album>
     */
    public async findRecommendedProfilesByArtist(artistId: string, exceptAlbumIds: string | string[] = [], authentication?: User): Promise<Page<Album>> {
        if(!exceptAlbumIds) exceptAlbumIds = []
        if(!Array.isArray(exceptAlbumIds)) {
            exceptAlbumIds = [ exceptAlbumIds ];
        }

        const result = await this.buildGeneralQuery("album", authentication)
            .take(10)
            .where("album.id NOT IN(:except) AND (primaryArtist.id = :artistId OR primaryArtist.slug = :artistId)", { except: exceptAlbumIds || [], artistId })
            .getMany()

        return Page.of(result, 10, 0);
    }

    /**
     * Find albums by song genres.
     * @param genreId Genre id
     * @param pageable Page settings
     * @param authentication Authentication Object
     * @returns Page<Album>
     */
    public async findByGenre(genreId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.buildGeneralQuery("album", authentication)
            .leftJoin("album.songs", "song")
            .leftJoin("song.genres", "genre")

            .skip(pageable.page * pageable?.size)
            .take(pageable.size)

            .where("genre.id = :genreId OR genre.slug = :genreId", { genreId })
            .getManyAndCount()

        return Page.of(result[0], result[1], pageable.page);
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
        return this.repository.save(album).then((result) => {
            this.sync(result);
            return result;
        });
    }

    /**
     * Create an album if not exists.
     * @param createAlbumDto Data to create album from
     * @returns Album
     */
    public async createIfNotExists(createAlbumDto: CreateAlbumDTO, waitForLock = false): Promise<CreateResult<Album>> {
        createAlbumDto.name = createAlbumDto.name?.trim();
        createAlbumDto.description = createAlbumDto.description?.trim();
        if(!createAlbumDto.primaryArtist) throw new BadRequestException("Creating album without primary artist is not allowed.");

        // Acquire lock
        return this.lock(`${createAlbumDto.name}_${createAlbumDto.primaryArtist.name}`, async (signal) => {
            const existingAlbum = await this.findByNameAndArtist(createAlbumDto.name, createAlbumDto.primaryArtist);
            if(existingAlbum) return new CreateResult(existingAlbum, true); 
            if(signal.aborted) throw new RedlockError();

            const album = new Album();
            album.name = createAlbumDto.name;
            album.description = createAlbumDto.description;
            album.releasedAt = createAlbumDto.releasedAt;
            album.primaryArtist = createAlbumDto.primaryArtist;

            return this.save(album).then((result) => {
                // Emit changed event to proceed with automatic genius lookup
                if(createAlbumDto.lookupGenius) this.eventEmitter.emit(EVENT_ALBUM_CHANGED, new AlbumChangedEvent(result));
                return new CreateResult(result, false);
            })
        }, waitForLock).catch((error: Error) => {
            this.logger.error(`Failed creating album: ${error.message}`, error.stack);
            throw new InternalServerErrorException();
        })
    }

    /**
     * Update an existing album.
     * @param albumId Album's id
     * @param updateAlbumDto Updated album data
     * @returns Album
     */
    public async update(albumId: string, updateAlbumDto: UpdateAlbumDTO): Promise<Album> {
        updateAlbumDto.name = updateAlbumDto.name.trim();
        updateAlbumDto.description = updateAlbumDto.description?.trim();
        if(!updateAlbumDto.primaryArtist) throw new BadRequestException("Creating album without primary artist is not allowed.");

        const album = await this.resolveAlbum(albumId);
        if(!album) throw new NotFoundException("Album not found");

        album.name = updateAlbumDto.name;
        album.primaryArtist = updateAlbumDto.primaryArtist;
        album.description = updateAlbumDto.description;
        album.releasedAt = updateAlbumDto.releasedAt;
        
        return this.save(album).then((result) => {
            // Emit changed event to proceed with automatic genius lookup
            if(updateAlbumDto.lookupGenius) this.eventEmitter.emit(EVENT_ALBUM_CHANGED, new AlbumChangedEvent(result));
            return result;
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
     * Update the sync flag of an album.
     * @param idOrObject Id or object of the album
     * @param flag Updated sync flag
     * @returns Album
     */
    private async setSyncFlag(idOrObject: string | Album, flag: SyncFlag): Promise<Album> {
        const resource = await this.resolveAlbum(idOrObject);
        if(!resource) return null;

        resource.lastSyncedAt = new Date();
        resource.lastSyncFlag = flag;
        return this.repository.save(resource);
    }

    /**
     * Synchronize the corresponding document on meilisearch.
     * @param resource Album data
     * @returns Album
     */
    private async sync(resource: Album) {
        return this.meiliAlbum.setAlbum(resource).then(() => {
            return this.setSyncFlag(resource, SyncFlag.OK);
        }).catch(() => {
            return this.setSyncFlag(resource, SyncFlag.ERROR);
        });
    }

    /**
     * Find album by its id or object itself.
     * @param idOrObject Id or album object
     * @returns Album
     */
    private async resolveAlbum(idOrObject: string | Album): Promise<Album> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject;
    }

    private buildGeneralQuery(alias: string, authentication?: User): SelectQueryBuilder<Album> {
        return this.repository.createQueryBuilder(alias)
            .leftJoin(`${alias}.artwork`, "artwork").addSelect(["artwork.id"])
            .leftJoin(`${alias}.primaryArtist`, "primaryArtist").addSelect(["primaryArtist.id", "primaryArtist.slug", "primaryArtist.name"])
            .loadRelationCountAndMap(`${alias}.liked`, `${alias}.likedBy`, "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))
    }    

}
