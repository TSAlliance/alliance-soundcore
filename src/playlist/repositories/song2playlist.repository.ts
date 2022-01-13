import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { Song2Playlist } from "../entities/song2playlist.entity";

@EntityRepository(Song2Playlist)
export class Song2PlaylistRepository extends PageableRepository<Song2Playlist> {}