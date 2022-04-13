import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { ArtistModule } from './artist/artist.module';
import { AllianceRestModule } from '@tsalliance/rest';
import { BucketModule } from './bucket/bucket.module';
import { IndexModule } from './index/index.module';
import { AlbumModule } from './album/album.module';
import { StorageModule } from './storage/storage.module';
import { SharedModule } from './shared/shared.module';
import { SongModule } from './song/song.module';
import { GeniusModule } from './genius/genius.module';
import { LabelModule } from './label/label.module';
import { PublisherModule } from './publisher/publisher.module';
import { UploadModule } from './upload/upload.module';
import { SearchModule } from './search/search.module';
import { StreamModule } from './stream/stream.module';
import { DistributorModule } from './distributor/distributor.module';
import { GenreModule } from './genre/genre.module';
import { PlaylistModule } from './playlist/playlist.module';
import { UserModule } from './user/user.module';
import { ImportModule } from './import/import.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CollectionModule } from './collection/collection.module';
import { IndexReportModule } from './index-report/index-report.module';
import { BullModule } from '@nestjs/bull';
import { KeycloakModule } from './authentication/keycloak.module';
import { SoundcoreMeiliModule } from '@soundcore/soundcore-meili';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        ".env.dev",
        ".env"
      ]
    }),
    SoundcoreMeiliModule.forRoot({
      host: process.env.MEILISEARCH_HOST,
      port: parseInt(process.env.MEILISEARCH_PORT),
      key: process.env.MEILISEARCH_KEY
    }),
    TypeOrmModule.forRoot({
      type: "mysql",
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [
        "src/**/*.entity{ .ts,.js}",
        "dist/**/*.entity{ .ts,.js}"
      ],
      synchronize: true,
      entityPrefix: process.env.DB_PREFIX,
      retryAttempts: Number.MAX_VALUE,
      retryDelay: 10000
    }),
    MulterModule.register(),
    AllianceRestModule.forRoot({
      logging: false,
      disableErrorHandling: true,
      disableValidation: false
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
        password: process.env.REDIS_AUTH_PASS,
      },
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true
      }
    }),
    EventEmitterModule.forRoot({ global: true, ignoreErrors: true }),
    SharedModule,
    ArtistModule,
    BucketModule,
    IndexModule,
    AlbumModule,
    StorageModule,
    SongModule,
    GeniusModule,
    LabelModule,
    PublisherModule,
    UploadModule,
    SearchModule,
    StreamModule,
    DistributorModule,
    GenreModule,
    PlaylistModule,
    UserModule,
    ImportModule,
    CollectionModule,
    IndexReportModule,
    KeycloakModule
  ],
  controllers: [],
  providers: []
})
export class AppModule {}
