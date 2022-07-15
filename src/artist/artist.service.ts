import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { Repository } from 'typeorm';
import { EVENT_ARTIST_CREATED } from '../constants';
import { RedlockError } from '../exceptions/redlock.exception';
import { Mount } from '../mount/entities/mount.entity';
import { User } from '../user/entities/user.entity';
import { GeniusFlag, ResourceFlag } from '../utils/entities/resource';
import { RedisLockableService } from '../utils/services/redis-lockable.service';
import { CreateArtistDTO } from './dtos/create-artist.dto';
import { Artist } from './entities/artist.entity';

@Injectable()
export class ArtistService extends RedisLockableService {
    private logger: Logger = new Logger(ArtistService.name)

    constructor(
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
        return this.repository.save(artist);
    }

    /**
     * Create an artist if not exists.
     * @param createArtistDto Data to create artist from
     * @returns Artist
     */
    public async createIfNotExists(createArtistDto: CreateArtistDTO, useMount: Mount): Promise<{ artist: Artist, existed: boolean }> {
        createArtistDto.name = createArtistDto.name?.replace(/^[ ]+|[ ]+$/g,'').trim();

        // Acquire lock
        return this.lock(createArtistDto.name, async (signal) => {
            const existingArtist = await this.findByName(createArtistDto.name);
            if(existingArtist) return { artist: existingArtist, existed: true }; 
            if(signal.aborted) throw new RedlockError();

            const artist = new Artist();
            artist.name = createArtistDto.name;
            artist.description = createArtistDto.description;

            return this.repository.save(artist).then(async (result) => {
                // If genius lookup is triggered on creation,
                // emit event for the genius service to catch
                // the artist and trigger the lookup.
                if(createArtistDto.lookupGenius) {
                    this.eventEmitter.emit(EVENT_ARTIST_CREATED, artist, useMount)
                }
                return { artist: result, existed: false };
            }).catch(async (error) => {
                throw error;
            });
        })
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
