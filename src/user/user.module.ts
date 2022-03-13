import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRepository } from './repositories/user.repository';
import { ArtworkModule } from '../artwork/artwork.module';

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [
    TypeOrmModule.forFeature([ UserRepository ]),
    ArtworkModule
  ],
  exports: [
    UserService
  ]
})
export class UserModule {}
