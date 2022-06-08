import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Page, Pageable } from 'nestjs-pager';
import { EVENT_ARTIST_CREATED } from '../constants';
import { RedlockError } from '../exceptions/redlock.exception';
import { User } from '../user/entities/user.entity';
import { RedisLockableService } from '../utils/services/redis-lockable.service';
import { CreateArtistDTO } from './dtos/create-artist.dto';
import { Artist } from './entities/artist.entity';
import { ArtistRepository } from './repositories/artist.repository';

@Injectable()
export class ArtistService extends RedisLockableService {
    private logger: Logger = new Logger(ArtistService.name)

    constructor(
        private readonly repository: ArtistRepository,
        private readonly eventEmitter: EventEmitter2
    ){
        super();
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
     * Create an artist if not exists.
     * @param createArtistDto Data to create artist from
     * @returns Artist
     */
    public async createIfNotExists(createArtistDto: CreateArtistDTO): Promise<Artist> {
        createArtistDto.name = createArtistDto.name?.replace(/^[ ]+|[ ]+$/g,'').trim();

        // Acquire lock
        return this.lock(createArtistDto.name, async (signal) => {
            const existingArtist = await this.findByName(createArtistDto.name);
            if(existingArtist) return existingArtist; 
            if(signal.aborted) throw new RedlockError();

            const artist = new Artist();
            artist.name = createArtistDto.name;
            artist.description = createArtistDto.description;

            return this.repository.save(artist).then(async (result) => {
                // If genius lookup is triggered on creation,
                // emit event for the genius service to catch
                // the artist and trigger the lookup.
                if(createArtistDto.lookupGenius) this.eventEmitter.emit(EVENT_ARTIST_CREATED, artist)
                return result;
            }).catch(async (error) => {
                throw error;
            });
        })
    }

    /**
     * Create new database entry using the artists name.
     * If a conflict or error occurs, a find query is executed
     * and if a matching entry already exists, it will be returned instead.
     * Use case for this is to prevent duplicate entries and avoid using locks.
     * (But its a weird solution)
     * @param name Name of the artist to create
     * @returns Artist
     */
    public async findOrCreateByName(name: string): Promise<Artist> {
        const artist = new Artist();
        artist.name = name;
        
        return this.repository.save(artist).catch(() => {
            return this.findByName(name);
        })
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
