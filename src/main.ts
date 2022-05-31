import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true, abortOnError: false });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  app.enableCors();
  await app.listen(3001);
}

bootstrap();
