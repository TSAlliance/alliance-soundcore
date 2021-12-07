import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { StreamService } from './stream.service';

@Controller('streaming')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Get("/songs/:songId")
  public async streamSongById(@Param("songId") songId: string, @Req() request: Request, @Res() response: Response) {
    return this.streamService.findStreamableSongById(songId, request, response);
  }
}
