import { Controller, Get, Param } from '@nestjs/common';
import { Authentication, CanAccess, IsAuthenticated } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { User } from '../user/entities/user.entity';
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

  @Get("byCollection")
  @IsAuthenticated()
  public async findByCollection(@Authentication() user: User, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByCollection(user, pageable)
  }

  @Get("/byUploader/:uploaderId")
  @CanAccess("songs.read")
  public async findByUploader(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByUploaderId(uploaderId, pageable);
  }

  @Get("/byGenre/:genreId")
  @IsAuthenticated()
  public async findByGenre(@Param("genreId") genreId: string, @Pageable() pageable: Pageable): Promise<Page<Song>> {
    return this.songService.findByGenre(genreId, pageable)
  }

  @Get("/byArtist/:artistId/top")
  @IsAuthenticated()
  public async findTopSongsByArtist(@Param("artistId") artistId: string, @Authentication() user: User): Promise<Song[]> {
    return this.songService.findTopSongsByArtist(artistId, user)
  }

  @Get("/byAlbum/:albumId")
  @IsAuthenticated()
  public async findByAlbum(@Param("albumId") albumId: string, @Authentication() user: User): Promise<Page<Song>> {
    return this.songService.findByAlbum(albumId, user)
  }

  @Get(":songId")
  public async findById(@Param("songId") songId: string): Promise<Song> {
    return this.songService.findByIdInfoWithRelations(songId);
  }

}
