import { Module } from '@nestjs/common';
import { LabelService } from './services/label.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelRepository } from './repositories/label.repository';
import { ArtworkModule } from '../artwork/artwork.module';
import { LabelController } from './controllers/label.controller';

@Module({
  controllers: [LabelController],
  providers: [LabelService],
  imports: [
    ArtworkModule,
    TypeOrmModule.forFeature([ LabelRepository ])
  ],
  exports: [
    LabelService
  ]
})
export class LabelModule {}
