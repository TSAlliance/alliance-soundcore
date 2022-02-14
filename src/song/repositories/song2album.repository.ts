import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Song2Album } from "../entities/song2album.entity";

@EntityRepository(Song2Album)
export class Song2AlbumRepository extends PageableRepository<Song2Album> {}