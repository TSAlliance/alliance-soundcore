import { Module } from '@nestjs/common';
import { ActivityService } from './services/activity.service';
import { ActivityController } from './controllers/activity.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityRepository } from './repositories/activity.repository';
import { StatusGateway } from './gateways/status.gateway';

@Module({
  providers: [ActivityService, StatusGateway],
  controllers: [ActivityController],
  imports: [
    TypeOrmModule.forFeature([ ActivityRepository ])
  ],
  exports: [
    ActivityService
  ]
})
export class ActivityModule {}
