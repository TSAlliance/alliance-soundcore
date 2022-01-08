import { Injectable, Logger } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { CreateGenreDTO } from './dtos/create-genre.dto';
import { Genre } from './entities/genre.entity';
import { GenreRepository } from './repositories/genre.repository';

@Injectable()
export class GenreService {
    private logger: Logger = new Logger(GenreService.name)

    constructor(private genreRepository: GenreRepository) {}

    /**
     * Create new genre by name if it does not already exist in the database.
     * @param createGenreDto Genre data to create
     * @returns Genre
     */
     public async createIfNotExists(createGenreDto: CreateGenreDTO): Promise<Genre> {
        const genre: Genre = await this.genreRepository.findOne({ where: { name: createGenreDto.name }})
        if(genre) return genre;

        const genreResult = await this.genreRepository.save({ name: createGenreDto.name, geniusId: createGenreDto.geniusId })

        if(!genreResult) {
            this.logger.error("Could not create genre.")
            return null;
        }

        return this.genreRepository.save(genreResult)
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Genre>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        return this.genreRepository.findAll(pageable, { where: { name: ILike(query) }})
    }

}
