import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Page, Pageable } from 'nestjs-pager';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { RedlockError } from '../../exceptions/redlock.exception';
import { CreateResult } from '../../utils/results/creation.result';
import { RedisLockableService } from '../../utils/services/redis-lockable.service';
import { CreateGenreDTO } from '../dtos/create-genre.dto';
import { UpdateGenreDTO } from '../dtos/update-genre.dto';
import { Genre } from '../entities/genre.entity';

@Injectable()
export class GenreService extends RedisLockableService {
    private readonly logger: Logger = new Logger(GenreService.name)

    constructor(
        @InjectRepository(Genre) private readonly repository: Repository<Genre>
    ) {
        super();
    }

    /**
     * Find a page of genres
     * @param pageable Page settings
     * @returns Page<Genre>
     */
    public async findAll(pageable: Pageable): Promise<Page<Genre>> {
        const result = await this.buildGeneralQuery("genre")
            .skip(pageable.page * pageable.size)
            .take(pageable.size)
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    /**
     * Find a genre by its id.
     * @param genreId Id of the genre
     * @returns Genre
     */
    public async findById(genreId: string): Promise<Genre> {
        return this.buildGeneralQuery("genre")
            .where("genre.id = :genreId OR genre.slug = :genreId", { genreId })
            .getOne();
    }

    /**
     * Find a genre by its name.
     * @param name Name of the genre
     * @returns Genre
     */
    public async findByName(name: string): Promise<Genre> {
        return this.buildGeneralQuery("genre")
            .where("genre.name = :name", { name })
            .getOne();
    }

    /**
     * Find a genre of an artist.
     * This will lookup the songs of an artist in database and
     * out of the songs relation to a genre a page of genres
     * is generated.
     * @param artistIdOrSlug Id or slug of the artist
     * @param pageable Page settings
     * @returns Page<Genre>
     */
    public async findByArtist(artistIdOrSlug: string, pageable: Pageable): Promise<Page<Genre>> {
        const result = await this.repository.createQueryBuilder("genre")
            .leftJoin("genre.songs", "song")
            .leftJoin("song.artists", "artist")

            .limit(pageable.size || 30)
            .offset((pageable.page || 0) * (pageable.size || 30))

            .where("artist.id = :artistIdOrSlug OR artist.slug = :artistIdOrSlug", { artistIdOrSlug })
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    /**
     * Create new genre by name if it does not already exist in the database.
     * @param createGenreDto Genre data to create
     * @returns Genre
     */
     public async createIfNotExists(createGenreDto: CreateGenreDTO, waitForLock = false): Promise<CreateResult<Genre>> {
        createGenreDto.name = createGenreDto.name.trim();
        createGenreDto.description = createGenreDto.description?.trim();

        // Acquire lock
        return this.lock(createGenreDto.name, (signal) => {
            // Check if genre with name already exists
            return this.findByName(createGenreDto.name).then((existingGenre) => {
                if(existingGenre) return { data: existingGenre, existed: true };
                if(signal.aborted) throw new RedlockError();

                // Update genre
                const genre = new Genre();
                genre.name = createGenreDto.name;
                genre.geniusId = createGenreDto.geniusId;
                genre.description = createGenreDto.description;
                
                return this.repository.save(genre).then((result) => ({ data: result, existed: false }));
            });
        }, waitForLock).catch((error: Error) => {
            this.logger.error(`Failed creating genre: ${error.message}`, error.stack);
            throw new InternalServerErrorException();
        });
    }

    /**
     * Update genre data
     * @param genreId Id of the genre
     * @param updateGenreDto Updated genre data
     * @returns Genre
     */
    public async update(genreId: string, updateGenreDto: UpdateGenreDTO): Promise<Genre> {
        updateGenreDto.name = updateGenreDto.name.trim();
        updateGenreDto.description = updateGenreDto.description?.trim();

        const genre = await this.findById(genreId);
        if(!genre) throw new NotFoundException("Genre not found.");

        return this.lock(genre.name, () => {
            genre.name = updateGenreDto.name;
            genre.geniusId = updateGenreDto.geniusId;
            genre.description = updateGenreDto.description;

            return this.repository.save(genre);
        });
    }

    private buildGeneralQuery(alias: string): SelectQueryBuilder<Genre> {
        return this.repository.createQueryBuilder(alias)
            .leftJoin(`${alias}.artwork`, "artwork").addSelect(["artwork.id"])
    }

}
