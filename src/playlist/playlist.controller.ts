import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Authentication, IsAuthenticated, SSOUser } from '@tsalliance/sso-nest';
import { Pageable } from 'nestjs-pager';
import { CreatePlaylistDTO } from './dtos/create-playlist.dto';
import { PlaylistService } from './playlist.service';

@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get(":authorId") 
  public async findPlaylistsOfUser(@Param("authorId") authorId: string, @Pageable() pageable: Pageable, @Authentication() requester: SSOUser) {
    return this.playlistService.findPageByAuthor(authorId, pageable, requester);
  }

  @Post() 
  @IsAuthenticated()
  public async createPlaylist(@Body() createPlaylistDto: CreatePlaylistDTO, @Authentication() author: SSOUser) {
    return this.playlistService.create(createPlaylistDto, author);
  }
}
