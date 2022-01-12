import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { Authentication, IsAuthenticated, SSOUser } from '@tsalliance/sso-nest';
import { Pageable } from 'nestjs-pager';
import { CreatePlaylistDTO } from './dtos/create-playlist.dto';
import { UpdatePlaylistSongsDTO } from './dtos/update-songs.dto';
import { PlaylistService } from './playlist.service';

@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get(":playlistId") 
  @IsAuthenticated()
  public async findPlaylistById(@Param("playlistId") playlistId: string, @Authentication() requester: SSOUser) {
    return this.playlistService.findPlaylistProfileById(playlistId, requester);
  }

  @Get("/songs/:playlistId") 
  @IsAuthenticated()
  public async findSongInPlaylist(@Param("playlistId") playlistId: string, @Pageable() pageable: Pageable, @Authentication() requester: SSOUser) {
    return this.playlistService.findSongsInPlaylist(playlistId, pageable, requester)
  }

  @Get("/byAuthor/:authorId") 
  @IsAuthenticated()
  public async findPlaylistsOfUser(@Param("authorId") authorId: string, @Pageable() pageable: Pageable, @Authentication() requester: SSOUser) {
    return this.playlistService.findAllOrPageByAuthor(authorId, pageable, requester);
  }

  @Post() 
  @IsAuthenticated()
  public async createPlaylist(@Body() createPlaylistDto: CreatePlaylistDTO, @Authentication() author: SSOUser) {
    return this.playlistService.create(createPlaylistDto, author);
  }

  @Put("/songs/:playlistId") 
  @IsAuthenticated()
  public async updateSongs(@Param("playlistId") playlistId: string, @Body() updateSongsDto: UpdatePlaylistSongsDTO, @Authentication() requester: SSOUser) {
    return this.playlistService.updateSongs(playlistId, updateSongsDto, requester)
  }
}
