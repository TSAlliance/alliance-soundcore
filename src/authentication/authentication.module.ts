import { Module } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';

@Module({
  controllers: [],
  providers: [AuthenticationService]
})
export class AuthenticationModule {}
