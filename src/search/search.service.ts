import { Injectable } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { SongService } from '../song/song.service';

@Injectable()
export class SearchService {

    constructor(private songService: SongService) {}

    public async complexSearch(query: string, pageable: Pageable): Promise<any> {
        const songs = await this.songService.findBySearchQuery(query, pageable)

        // TODO: Create proper type
        return {
            songs
        }

    }

}
