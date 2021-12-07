import { Controller, Get, Param } from '@nestjs/common';
import { SongService } from './song.service';

@Controller('songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get(":songId")
  public async findById(@Param("songId") songId: string) {
    return this.songService.findById(songId);
  }
}
