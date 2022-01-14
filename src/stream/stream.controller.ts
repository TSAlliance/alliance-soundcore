import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { StreamService } from './stream.service';

@Controller('streams')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  // TODO: Implement authorization, but this requires additional adjustments in FE

  @Get("/songs/:songId")
  public async streamSongById(@Param("songId") songId: string, @Query("accessToken") session: string, @Req() request: Request, @Res() response: Response) {
    return this.streamService.findStreamableSongById(songId, session, request, response);
  }

}
