import { Controller, Get } from '@nestjs/common';
import { Page } from 'nestjs-pager';
import { Song } from './entities/song.entity';
import { SongService } from './song.service';

@Controller('songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get("latest")
  public async findLatest(): Promise<Page<Song>> {
    return this.songService.findLatestPage();
  }

  @Get("oldest")
  public async findOldestRelease(): Promise<Page<Song>> {
    return this.songService.findOldestReleasePage();
  }
}
