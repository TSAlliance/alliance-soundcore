import { Module } from '@nestjs/common';
import { FriendService } from './services/friend.service';

@Module({
  providers: [FriendService]
})
export class FriendModule {}
