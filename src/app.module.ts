import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { SSOModule, SSOUser } from "@tsalliance/sso-nest"
import { ArtistModule } from './artist/artist.module';
import { AllianceRestModule } from '@tsalliance/rest';
import { BucketModule } from './bucket/bucket.module';
import { IndexModule } from './index/index.module';
import { AlbumModule } from './album/album.module';
import { GenreModule } from './genre/genre.module';
import { StorageModule } from './storage/storage.module';
import { SharedModule } from './shared/shared.module';
import { SongModule } from './song/song.module';
import { GeniusModule } from './genius/genius.module';
import { LabelModule } from './label/label.module';
import { PublisherModule } from './publisher/publisher.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        ".env.dev",
        ".env"
      ]
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
        "dist/**/*.entity{ .ts,.js}",
        SSOUser
      ],
      synchronize: true,
      entityPrefix: process.env.DB_PREFIX,
      retryAttempts: Number.MAX_VALUE,
      retryDelay: 10000
    }),
    MulterModule.register(),
    SSOModule.forRoot({
      baseUrl: process.env.SSO_URL,
      clientId: process.env.SSO_CLIENT_ID,
      clientSecret: process.env.SSO_CLIENT_SECRET,
      redirectUri: process.env.SSO_REDIRECT_URI,
      logging: false
    }),
    AllianceRestModule.forRoot({
      logging: false,
      disableErrorHandling: false,
      disableValidation: false
    }),
    SharedModule,
    ArtistModule,
    BucketModule,
    IndexModule,
    AlbumModule,
    GenreModule,
    StorageModule,
    SongModule,
    GeniusModule,
    LabelModule,
    PublisherModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
