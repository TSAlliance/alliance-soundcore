import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './controllers/notification.controller';
import { NotificationRepository } from './repositories/notification.repository';
import { NotificationService } from './services/notification.service';
import { NotificationGateway } from './gateway/notification.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  controllers: [
    NotificationController
  ],
  providers: [
    NotificationService,
    NotificationGateway
  ],
  imports: [
    JwtModule.register({
      
    }),
    TypeOrmModule.forFeature([ NotificationRepository ])
  ],
  exports: [
    NotificationService
  ]
})
export class NotificationModule {}
