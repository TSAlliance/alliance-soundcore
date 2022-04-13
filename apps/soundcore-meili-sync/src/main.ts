import { NestFactory } from '@nestjs/core';
import { SoundcoreMeiliSyncModule } from './soundcore-meili-sync.module';

async function bootstrap() {
  const app = await NestFactory.create(SoundcoreMeiliSyncModule);
  await app.listen(3000);
}
bootstrap();
