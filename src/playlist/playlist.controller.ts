import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Authentication, IsAuthenticated } from '@tsalliance/sso-nest';
import { Pageable } from 'nestjs-pager';
import { User } from '../user/entities/user.entity';
import { CreatePlaylistDTO } from './dtos/create-playlist.dto';
import { UpdatePlaylistDTO } from './dtos/update-playlist.dto';
import { PlaylistService } from './playlist.service';

@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Get(":playlistId") 
  @IsAuthenticated()
  public async findPlaylistById(@Param("playlistId") playlistId: string, @Authentication() requester: User) {
    return this.playlistService.findPlaylistProfileById(playlistId, requester);
  }

  @Delete(":playlistId") 
  @IsAuthenticated()
  public async deleteById(@Param("playlistId") playlistId: string, @Authentication() requester: User) {
    return this.playlistService.deleteById(playlistId, requester);
  }

  @Put(":playlistId/songs/add") 
  @IsAuthenticated()
  public async addSongs(@Param("playlistId") playlistId: string, @Body() songIds: string[], @Authentication() requester: User) {
    return this.playlistService.addSongs(playlistId, songIds, requester)
  }

  @Put(":playlistId/songs/remove") 
  @IsAuthenticated()
  public async removeSongs(@Param("playlistId") playlistId: string, @Body() songIds: string[], @Authentication() requester: User) {
    return this.playlistService.removeSongs(playlistId, songIds, requester)
  }

  @Put(":playlistId/collaborators/add") 
  @IsAuthenticated()
  public async addCollaborators(@Param("playlistId") playlistId: string, @Body() collaboratorIds: string[], @Authentication() requester: User) {
    return this.playlistService.addCollaborators(playlistId, collaboratorIds, requester)
  }

  @Put(":playlistId/collaborators/remove") 
  @IsAuthenticated()
  public async removeCollaborators(@Param("playlistId") playlistId: string, @Body() collaboratorIds: string[], @Authentication() requester: User) {
    return this.playlistService.removeCollaborators(playlistId, collaboratorIds, requester)
  }

  

  @Get("/byAuthor/:authorId") 
  @IsAuthenticated()
  public async findPlaylistsOfUser(@Param("authorId") authorId: string, @Pageable() pageable: Pageable, @Authentication() requester: User) {
    if(authorId == requester.id) {
      return this.playlistService.findByUser(pageable, requester)
    }

    return this.playlistService.findByAuthor(authorId, pageable, requester);
  }

  @Get("/byGenre/:genreId") 
  @IsAuthenticated()
  public async findByGenre(@Param("genreId") genreId: string, @Pageable() pageable: Pageable, @Authentication() requester: User) {
    return this.playlistService.findByGenre(genreId, pageable, requester);
  }

  @Post() 
  @IsAuthenticated()
  public async createPlaylist(@Body() createPlaylistDto: CreatePlaylistDTO, @Authentication() author: User) {
    return this.playlistService.create(createPlaylistDto, author);
  }

  @Put(":playlistId") 
  @IsAuthenticated()
  public async updatePlaylist(@Param("playlistId") playlistId: string, @Body() updatePlaylistDto: UpdatePlaylistDTO, @Authentication() requester: User) {
    return this.playlistService.update(playlistId, updatePlaylistDto, requester);
  }

  /*@Get("/song-list/byArtist/:artistId") 
  @IsAuthenticated()
  public async findSongListOfArtist(@Param("artistId") artistId: string, @Authentication() requester: User) {
    // TODO:
  }

  @Get("/song-list/byArtistTop/:artistId") 
  @IsAuthenticated()
  public async findSongListOfArtistTop(@Param("artistId") artistId: string, @Authentication() requester: User) {
    // TODO:
  }

  @Get("/song-list/byCollection/byArtist/:artistId") 
  @IsAuthenticated()
  public async findSongListOfCollectionByArtist(@Param("artistId") artistId: string, @Authentication() user: User) {
    // TODO:
  }

  @Get("/song-list/byCollection/:placeholder") 
  @IsAuthenticated()
  public async findSongListOfCollection(@Authentication() user: User) {
    // TODO:
  }

  @Get("/song-list/byCollection/:albumId") 
  @IsAuthenticated()
  public async findSongListOfAlbum(@Param("albumId") albumId: string,@Authentication() user: User) {
    // TODO:
  }*/

  
}
