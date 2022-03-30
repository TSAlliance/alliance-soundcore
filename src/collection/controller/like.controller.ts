import { Controller, Param, Post } from '@nestjs/common';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { User } from '../../user/entities/user.entity';
import { LikeService } from '../services/like.service';

@Controller('likes')
export class LikeController {

  constructor(private readonly likeService: LikeService) {}

  @Post("/song/:songId")
  public async likeSong(@Param("songId") songId: string, @AuthenticatedUser() user: User): Promise<boolean> {
    return this.likeService.likeSong(songId, user);
  }

  @Post("/playlist/:playlistId")
  public async likePlaylist(@Param("playlistId") playlistId: string, @AuthenticatedUser() user: User): Promise<boolean> {
    return this.likeService.likePlaylist(playlistId, user)
  }

  @Post("/album/:albumId")
  public async likeAlbum(@Param("albumId") albumId: string, @AuthenticatedUser() user: User): Promise<boolean> {
    return this.likeService.likeAlbum(albumId, user)
  }

}
