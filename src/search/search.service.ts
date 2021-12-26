import { Injectable } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { ArtistService } from '../artist/artist.service';

@Injectable()
export class SearchService {

    constructor(
        private artistService: ArtistService
    ) {}

    public async complexSearch(query: string, pageable: Pageable): Promise<any> {
        const artists = await this.artistService.findBySearchQuery(query, pageable)

        // TODO: Create proper type
        return {
            artists
        }

    }

}
