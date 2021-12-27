import { Inject, Injectable } from '@nestjs/common';
import { Artist } from '../artist/entities/artist.entity';
import { BUCKET_ID } from '../shared/shared.module';

@Injectable()
export class ArtworkService {

    constructor(
        @Inject(BUCKET_ID) private bucketId: string
    ){}

    // public async createFromArtist(artist: Artist): Promise<Artwork>

}
