import { Module } from '@nestjs/common';
import { StreamService } from './services/stream.service';
import { StreamController } from './stream.controller';
import { StorageModule } from '../storage/storage.module';
import { SongModule } from '../song/song.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamRepository } from './repositories/stream.repository';
import { StreamTokenService } from './services/stream-token.service';
import { JwtModule } from '@nestjs/jwt';
import { v4 as uuidv4 } from "uuid"

@Module({
  controllers: [
    StreamController
  ],
  providers: [
    StreamService,
    StreamTokenService
  ],
  imports: [
    SongModule,
    StorageModule,

    TypeOrmModule.forFeature([ StreamRepository ]),
    JwtModule.register({
      verifyOptions: {
        ignoreExpiration: true
      },
      secret: uuidv4()
    })
  ]
})
export class StreamModule {}
