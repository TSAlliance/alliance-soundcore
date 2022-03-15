import { Controller, Get, Param } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { Bucket } from '../entities/bucket.entity';
import { BucketService } from '../services/bucket.service';

@Controller('buckets')
export class BucketController {
  constructor(private readonly bucketService: BucketService) {}

  @Get(":bucketId")
  public async findById(@Param("bucketId") bucketId: string): Promise<Bucket> {
    return this.bucketService.findById(bucketId);
  }

  @Get()
  public async findAll(@Pageable() pageable: Pageable): Promise<Page<Bucket>> {
    return this.bucketService.findAll(pageable);
  }

}
