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
    private userRepository: UserRepository
  ) {
    this.ssoService.registerOnUserRecognizedEvent(async (user) => {
      // Do everything in background to not block executions in chain
      this.userRepository.findOne({ where: { id: user.id }}).then((result) => {
        // Create new user in database if there is no existing one for this id.
        if(!result) {
          this.userRepository.save(user).catch(() => {
            this.logger.warn("Could not save user info.")
          })
        } else {
          // Update user in database if username has changed.
          if(user.username != result.username || user.avatarResourceId != result.avatarResourceId) {
            this.userRepository.save(user).catch(() => {
              this.logger.warn("Could not save user info.")
            })
          }
        }

        
      }).catch(() => {
        this.logger.warn("Could not save user info.")
      })
      
      return user;
    })
  }

}
