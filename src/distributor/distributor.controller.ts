import { Controller } from '@nestjs/common';
import { DistributorService } from './distributor.service';

@Controller('distributor')
export class DistributorController {
  constructor(private readonly distributorService: DistributorService) {}
}
