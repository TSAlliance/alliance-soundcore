import { Controller, Get, Param } from '@nestjs/common';
import { Authentication } from '../authentication/decorators/authentication.decorator';

import { User } from '../user/entities/user.entity';
import { ArtistService } from './artist.service';

@Controller('artists')
export class ArtistController {
  constructor(private readonly artistService: ArtistService) {}

  // TODO: Functionality to trigger artist search on genius

  @Get(":artistId")
  public async findProfileById(@Param("artistId") artistId: string, @Authentication() user: User) {
    return this.artistService.findProfileById(artistId, user)
  }

}
