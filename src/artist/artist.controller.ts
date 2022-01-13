import { Controller, Get, Param } from '@nestjs/common';
import { ArtistService } from './artist.service';

@Controller('artists')
export class ArtistController {
  constructor(private readonly artistService: ArtistService) {}

  // TODO: Functionality to trigger artist search on genius

  @Get(":artistId")
  public async findProfileById(@Param("artistId") artistId: string) {
    return this.artistService.findProfileById(artistId)
  }

}
