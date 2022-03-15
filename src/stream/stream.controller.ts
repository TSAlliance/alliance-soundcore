import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthenticatedUser, Public } from 'nest-keycloak-connect';
import { User } from '../user/entities/user.entity';
import { StreamTokenService } from './services/stream-token.service';
import { StreamService } from './services/stream.service';

@Controller('streams')
export class StreamController {
  constructor(
    private readonly streamService: StreamService,
    private readonly tokenService: StreamTokenService
  ) {}

  @Get("/songs")
  @Public(true)
  public async streamSongById(@Query("token") tokenId: string, @Req() request: Request, @Res() response: Response) {
    return this.streamService.findStreamableSongById(tokenId, request, response);
  }

  @Get("/token/:songId")
  public async getToken(@Param("songId") songId: string, @AuthenticatedUser() user: User) {
    return this.tokenService.createForSong(user, songId);
  }

}
