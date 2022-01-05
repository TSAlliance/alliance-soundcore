import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Playlist } from "../entities/playlist.entity";


@EntityRepository(Playlist)
export class PlaylistRepository extends PageableRepository<Playlist> {}