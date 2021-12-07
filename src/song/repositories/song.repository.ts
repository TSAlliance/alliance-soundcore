import { EntityRepository, Repository } from "typeorm";
import { Song } from "../entities/song.entity";

@EntityRepository(Song)
export class SongRepository extends Repository<Song> {}