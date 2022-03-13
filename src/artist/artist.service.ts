import { Injectable, Logger } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { GeniusService } from '../genius/services/genius.service';
import { User } from '../user/entities/user.entity';
import { CreateArtistDTO } from './dtos/create-artist.dto';
import { Artist } from './entities/artist.entity';
import { ArtistRepository } from './repositories/artist.repository';

@Injectable()
export class ArtistService {
    
    private logger: Logger = new Logger(ArtistService.name)

    constructor(
        private geniusService: GeniusService,
        private artistRepository: ArtistRepository
    ){}

    public async findProfileById(artistId: string, user: User): Promise<Artist> {
        const result = await this.artistRepository.createQueryBuilder("artist")
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
        
        const likedCount = await this.artistRepository.createQueryBuilder("artist")
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
        return await this.artistRepository.findOne({ where: { name }});
    }

    public async existsByName(name: string): Promise<boolean> {
        return !!(await this.artistRepository.findOne({ where: { name }}));
    }

    public async createIfNotExists(createArtistDto: CreateArtistDTO): Promise<Artist> {
        createArtistDto.name = createArtistDto.name?.replace(/^[ ]+|[ ]+$/g,'')
        // Get artist from db if it does exists.
        // The regex removes leading and trailing spaces
        let artist = await this.findByName(createArtistDto.name)
        
        // Artist exists? If not, create and gather information
        // Otherwise just return existing artist.
        if(!artist) {

            // Create new artist in database
            artist = new Artist();
            artist.name = createArtistDto.name;
            artist.description = createArtistDto.description;
            artist.geniusId = createArtistDto.geniusId;
            artist.geniusUrl = createArtistDto.geniusUrl;
            artist = await this.artistRepository.save(artist)

            await this.geniusService.findAndApplyArtistInfo(artist, createArtistDto.mountForArtworkId).then(async () => {
                artist.hasGeniusLookupFailed = false;
                await this.artistRepository.save(artist);
            }).catch((reason) => {
                artist.hasGeniusLookupFailed = true;
                this.logger.warn(`Something went wrong whilst gathering information on artist '${createArtistDto.name}': ${reason.message}`)
                this.artistRepository.save(artist);
            })
        }

        return artist;
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Artist>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        let qb = this.artistRepository.createQueryBuilder("artist")
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
