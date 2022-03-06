import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { PlaylistItem } from "../entities/playlist-item.entity";

@EntityRepository(PlaylistItem)
export class Song2PlaylistRepository extends PageableRepository<PlaylistItem> {}