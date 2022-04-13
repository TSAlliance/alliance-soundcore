import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Genre } from "../entities/genre.entity";

@EntityRepository(Genre)
export class GenreRepository extends PageableRepository<Genre> {}