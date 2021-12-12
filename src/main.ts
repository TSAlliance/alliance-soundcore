import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: "*"
    }
  });
  
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1"
  })
  
  //app.useGlobalFilters(new ApiExceptionFilter())
  app.useGlobalPipes(new ValidationPipe())
  await app.listen(3001);
}

bootstrap();
