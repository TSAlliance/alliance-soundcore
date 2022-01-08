import { Module } from '@nestjs/common';
import { LabelService } from './label.service';
import { LabelController } from './label.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelRepository } from './repositories/label.repository';
import { ArtworkModule } from '../artwork/artwork.module';

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
