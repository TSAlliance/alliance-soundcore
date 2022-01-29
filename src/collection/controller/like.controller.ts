import { Controller, Param, Post } from '@nestjs/common';
import { Authentication, IsAuthenticated } from '@tsalliance/sso-nest';
import { User } from '../../user/entities/user.entity';
import { LikeService } from '../services/like.service';

@Controller('likes')
export class LikeController {

  constructor(private readonly likeService: LikeService) {}

  @Post("/song/:songId")
  @IsAuthenticated()
  public async likeSong(@Param("songId") songId: string, @Authentication() user: User) {
    return this.likeService.likeSong(songId, user)
  }

}
