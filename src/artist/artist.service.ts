import { Injectable } from '@nestjs/common';
import { ILike } from 'typeorm';
import { CreateArtistDto } from './dto/create-artist.dto';
import { Artist } from './entities/artist.entity';
import { ArtistRepository } from './repositories/artist.repository';

@Injectable()
export class ArtistService {

  constructor(private artistRepository: ArtistRepository) {}

  public async create(createArtistDto: CreateArtistDto): Promise<Artist> {
    //
    return
  }

  public async createIfNotExists(createArtistDto: CreateArtistDto): Promise<Artist> {
    const artistNameLike = `%${createArtistDto.name.replace(/\s/g, "_")}%`;
    console.log(artistNameLike)
    const result = await this.artistRepository.findOne({ where: { name: ILike(artistNameLike) }});

    return result || this.artistRepository.save(createArtistDto);
  }

}
