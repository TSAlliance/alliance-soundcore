import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SongModule } from './song/song.module';
import { UploadModule } from './upload/upload.module';
import { StreamModule } from './stream/stream.module';
import { MulterModule } from '@nestjs/platform-express';
import { UPLOAD_TMP_DIR } from './upload/services/storage.service';
import { AuthenticationModule } from './authentication/authentication.module';

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
        "dist/**/*.entity{ .ts,.js}"
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
    AuthenticationModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
