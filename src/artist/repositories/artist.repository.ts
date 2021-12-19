import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Artist } from "../entities/artist.entity";

@EntityRepository(Artist)
export class ArtistRepository extends PageableRepository<Artist> {
    
}