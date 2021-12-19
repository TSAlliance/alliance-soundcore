import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongModule } from './song/song.module';
import { UploadModule } from './upload/upload.module';
import { StreamModule } from './stream/stream.module';
import { MulterModule } from '@nestjs/platform-express';
import { UPLOAD_TMP_DIR } from './storage/storage.service';

import { SSOModule, SSOUser } from "@tsalliance/sso-nest"
import { ArtistModule } from './artist/artist.module';
import { AllianceRestModule } from '@tsalliance/rest';
import { SearchModule } from './search/search.module';
import { ArtworkModule } from './artwork/artwork.module';

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
    MulterModule.register({
      dest: UPLOAD_TMP_DIR
    }),
    SongModule,
    UploadModule,
    StreamModule,
    SSOModule.forRoot({
      baseUrl: process.env.SSO_URL,
      clientId: process.env.SSO_CLIENT_ID,
      clientSecret: process.env.SSO_CLIENT_SECRET,
      redirectUri: process.env.SSO_REDIRECT_URI,
      logging: false
    }),
    AllianceRestModule.forRoot({
      logging: false
    }),
    ArtistModule,
    SearchModule,
    ArtworkModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
