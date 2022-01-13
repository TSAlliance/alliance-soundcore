import { Controller, Get, Param } from '@nestjs/common';
import { CanAccess } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { Song } from './entities/song.entity';
import { SongService } from './song.service';

@Controller('songs')
export class SongController {
  constructor(private readonly songService: SongService) {}

  @Get(":songId")
  public async findById(@Param("songId") songId: string): Promise<Song> {
    return this.songService.findByIdInfoWithRelations(songId);
  }

  @Get("latest")
  public async findLatest(): Promise<Page<Song>> {
    return this.songService.findLatestPage();
  }

  @Get("oldest")
  public async findOldestRelease(): Promise<Page<Song>> {
    return this.songService.findOldestReleasePage();
  }

  @Get("/byUploader/:uploaderId")
  @CanAccess("songs.read")
  public async findByUploader(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByUploaderId(uploaderId, pageable);
  }

  @Get("/byGenre/:genreId")
  public async findByGenre(@Param("genreId") genreId: string, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByGenre(genreId, pageable)
  }

  @Get("/byArtist/:artistId/top")
  public async findTopSongsByArtist(@Param("artistId") artistId: string): Promise<Song[]> {
    return this.songService.findTopSongsByArtist(artistId)
  }

}
