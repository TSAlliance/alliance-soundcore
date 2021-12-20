import { Controller, Get, Param } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { SongService } from './song.service';

@Controller('songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get("latest")
  public async findAllLatest(@Pageable() pageable: Pageable) {
    return this.songService.findAllLatestWithRelations(pageable);
  }

  @Get(":songId")
  public async findById(@Param("songId") songId: string) {
    return this.songService.findById(songId);
  }
}
