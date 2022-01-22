import { Logger, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { SSOService } from '@tsalliance/sso-nest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRepository } from './repositories/user.repository';

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [
    TypeOrmModule.forFeature([ UserRepository ])
  ],
  exports: [
    UserService
  ]
})
export class UserModule {
  private logger: Logger = new Logger(UserModule.name);

  constructor(
    private ssoService: SSOService,
    private userService: UserService
  ) {
    this.ssoService.registerOnUserRecognizedEvent(async (user) => {
      // Do everything in background to not block executions in chain
      this.userService.createIfNotExists(user);
      return user;
    })
  }

}
