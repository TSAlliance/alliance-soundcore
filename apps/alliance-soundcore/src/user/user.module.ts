import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRepository } from './repositories/user.repository';
import { ArtworkModule } from '../artwork/artwork.module';
import { SoundcoreMeiliModule } from '@soundcore/soundcore-meili';
import { OnUserCreatedListener } from './listener/user-created.listener';
import { OnUserUpdatedListener } from './listener/user-updated.listener';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    OnUserCreatedListener,
    OnUserUpdatedListener
  ],
  imports: [
    TypeOrmModule.forFeature([ UserRepository ]),
    ArtworkModule,
    SoundcoreMeiliModule.forFeature()
  ],
  exports: [
    UserService
  ]
})
export class UserModule {}
