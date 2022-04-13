import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Song } from "../entities/song.entity";

@EntityRepository(Song)
export class SongRepository extends PageableRepository<Song> {}