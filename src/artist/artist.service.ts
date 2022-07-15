import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { Repository } from 'typeorm';
import { RedlockError } from '../exceptions/redlock.exception';
import { SyncFlag } from '../meilisearch/interfaces/syncable.interface';
import { MeiliArtistService } from '../meilisearch/services/meili-artist.service';
import { User } from '../user/entities/user.entity';
import { GeniusFlag, ResourceFlag } from '../utils/entities/resource';
import { CreateResult } from '../utils/results/creation.result';
import { RedisLockableService } from '../utils/services/redis-lockable.service';
import { CreateArtistDTO } from './dtos/create-artist.dto';
import { UpdateArtistDTO } from './dtos/update-artist.dto';
import { Artist } from './entities/artist.entity';

@Injectable()
export class ArtistService extends RedisLockableService {
    private logger: Logger = new Logger(ArtistService.name)

    constructor(
        private readonly meiliClient: MeiliArtistService,
        @InjectRepository(Artist) private readonly repository: Repository<Artist>,
        private readonly eventEmitter: EventEmitter2
    ){
        super();
    }

    public async findById(artistId: string): Promise<Artist> {
        return await this.repository.createQueryBuilder("artist")
            .where("artist.id = :artistId", { artistId })
            .getOne();
    }

    public async findProfileById(artistId: string, user: User): Promise<Artist> {
        const result = await this.repository.createQueryBuilder("artist")
            .leftJoinAndSelect("artist.artwork", "artwork")
            .leftJoinAndSelect("artist.banner", "banner")
            .leftJoin("artist.songs", "song")
            .leftJoin("song.streams", "stream")

            .addSelect("SUM(stream.streamCount) as streamCount")

            .loadRelationCountAndMap("artist.songCount", "artist.songs")
            .loadRelationCountAndMap("artist.albumCount", "artist.albums")

            .groupBy("artist.id")
            .where("artist.id = :artistId", { artistId })
            .orWhere("artist.slug = :artistId", { artistId })

            .getRawAndEntities();

        // TODO: Separate stats and artist info
        
        const likedCount = await this.repository.createQueryBuilder("artist")
            .leftJoin("artist.songs", "song")
            .leftJoin("song.likedBy", "likedBy", "likedBy.userId = :userId", { userId: user?.id })

            .groupBy("likedBy.userId")
            .addGroupBy("artist.id")


            .select(["artist.id", "COUNT(likedBy.id) AS likedCount"])

            .where("artist.id = :artistId", { artistId })
            .orWhere("artist.slug = :artistId", { artistId })

            .getRawMany()
        
        if(!result.entities[0]) return null;

        const artist = result.entities[0];
        artist.streamCount = result.raw[0].streamCount;
        artist.likedCount = likedCount.map((entry) => parseInt(entry["likedCount"] || 0)).reduce((prev: number, current: number) => prev + current, 0)
        return artist;
    }

    public async findByName(name: string): Promise<Artist> {
        return await this.repository.findOne({ where: { name }});
    }

    public async existsByName(name: string): Promise<boolean> {
        return !!(await this.repository.findOne({ where: { name }}));
    }

    /**
     * Save an artist entity.
     * @param artist Entity data to be saved
     * @returns Artist
     */
    public async save(artist: Artist): Promise<Artist> {
        return this.repository.save(artist).then((result) => {
            this.sync(result);
            return result;
        });
    }

    /**
     * Create an artist if not exists.
     * @param createArtistDto Data to create artist from
     * @returns Artist
     */
    public async createIfNotExists(createArtistDto: CreateArtistDTO): Promise<CreateResult<Artist>> {
        createArtistDto.name = createArtistDto.name?.replace(/^[ ]+|[ ]+$/g,'').trim();
        createArtistDto.description = createArtistDto.description?.trim();

        // Acquire lock
        return this.lock(createArtistDto.name, async (signal) => {
            const existingArtist = await this.findByName(createArtistDto.name);
            if(existingArtist) return new CreateResult(existingArtist, true); 
            if(signal.aborted) throw new RedlockError();

            const artist = new Artist();
            artist.name = createArtistDto.name;
            artist.description = createArtistDto.description;

            return this.save(artist).then((result) => {
                return new CreateResult(result, false);
            })
        });
    }

    /**
     * Update an artist by its id.
     * @param artistId Artist's id
     * @param updateArtistDto Updated artist data
     * @returns Artist
     */
    public async updateArtist(artistId: string, updateArtistDto: UpdateArtistDTO): Promise<Artist> {
        updateArtistDto.name = updateArtistDto.name?.replace(/^[ ]+|[ ]+$/g,'').trim();
        updateArtistDto.description = updateArtistDto.description?.trim();

        // Acquire lock
        return this.lock(updateArtistDto.name, async (signal) => {
            const artist = await this.findById(artistId);
            // Check if artist exists
            if(!artist) throw new NotFoundException("Artist not found.");
            // Check if name already exists
            if(await this.findByName(updateArtistDto.name)) throw new BadRequestException("Artist with that name already exists.");
            // Check if redlock is valid
            if(signal.aborted) throw new RedlockError();

            // Update data
            artist.name = updateArtistDto.name;
            artist.description = updateArtistDto.description;

            // Save to database
            return this.save(artist);
        });
    }

    /**
     * Delete an artist by its id.
     * @param artistId Artist's id
     * @returns True or False
     */
    public async deleteById(artistId: string): Promise<boolean> {
        return this.meiliClient.deleteArtist(artistId).then(() => {
            return this.repository.delete({ id: artistId }).then((result) => {
                return result.affected > 0;
            });
        });
    }

    /**
     * Set resource flag of an artist.
     * @param idOrObject Artist id or object
     * @param flag Resource flag
     * @returns Artist
     */
    public async setFlag(idOrObject: string | Artist, flag: ResourceFlag): Promise<Artist> {
        const artist = await this.resolveArtist(idOrObject);
        if(!artist) return null;

        artist.flag = flag;
        return this.repository.save(artist);
    }

    /**
     * Set resource flag of an artist.
     * @param idOrObject Artist id or object
     * @param flag Genius flag
     * @returns Artist
     */
    public async setGeniusFlag(idOrObject: string | Artist, flag: GeniusFlag): Promise<Artist> {
        const artist = await this.resolveArtist(idOrObject);
        if(!artist) return null;

        artist.geniusFlag = flag;
        return this.repository.save(artist);
    }

    /**
     * Resolve an id or object to an artist object.
     * @param idOrObject Artist id or object
     * @returns Artist
     */
    protected async resolveArtist(idOrObject: string | Artist): Promise<Artist> {
        if(typeof idOrObject == "string") {
            return this.findById(idOrObject);
        }

        return idOrObject;
    }

    /**
     * Update the sync flag of an artist.
     * @param idOrObject Id or object of the artist
     * @param flag Updated sync flag
     * @returns Artist
     */
    private async setSyncFlag(idOrObject: string | Artist, flag: SyncFlag): Promise<Artist> {
        const resource = await this.resolveArtist(idOrObject);
        if(!resource) return null;

        resource.lastSyncedAt = new Date();
        resource.lastSyncFlag = flag;
        return this.repository.save(resource);
    }

    /**
     * Synchronize the corresponding document on meilisearch.
     * @param resource Artist data
     * @returns Artist
     */
    private async sync(resource: Artist) {
        return this.meiliClient.setArtist(resource).then(() => {
            return this.setSyncFlag(resource, SyncFlag.OK);
        }).catch(() => {
            return this.setSyncFlag(resource, SyncFlag.ERROR);
        });
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Artist>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        let qb = this.repository.createQueryBuilder("artist")
            .leftJoinAndSelect("artist.artwork", "artwork")
            .leftJoinAndSelect("artist.banner", "banner")

            .limit(pageable.size)
            .offset(pageable.page * pageable.size)

            .where("artist.name LIKE :query", { query });

        if(query == "%") {
            qb = qb.orderBy("rand()");
        }

        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], pageable.page);
    }

}
