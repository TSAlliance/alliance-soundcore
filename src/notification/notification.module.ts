import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './controllers/notification.controller';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationService } from './services/notification.service';
import { NotificationGateway } from './gateway/notification.gateway';
import { UserModule } from '../user/user.module';

@Module({
  controllers: [
    NotificationController
  ],
  providers: [
    NotificationService,
    NotificationGateway
  ],
  imports: [
    UserModule,
    TypeOrmModule.forFeature([ NotificationRepository ])
  ],
  exports: [
    NotificationService
  ]
})
export class NotificationModule {}
