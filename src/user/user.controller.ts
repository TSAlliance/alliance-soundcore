import { Controller, Get, Headers, Param } from '@nestjs/common';
import { IsAuthenticated } from '@tsalliance/sso-nest';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(":userId")
  @IsAuthenticated()
  public async findById(@Param("userId") userId: string, @Headers("Authorization") authHeader: string) {
    // return this.userService.findProfileById(userId, authHeader);
    return null;
  }

}
