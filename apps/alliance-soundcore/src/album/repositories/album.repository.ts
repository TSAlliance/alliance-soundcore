import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Album } from "../entities/album.entity";

@EntityRepository(Album)
export class AlbumRepository extends PageableRepository<Album> {}