import { Controller, Get, Param } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { StorageBucketService } from '../services/bucket.service';

@Controller('storage-buckets')
export class StorageBucketController {

    constructor(private bucketService: StorageBucketService){}

    @Get()
    public async findAll(@Pageable() pageable: Pageable) {
        return this.bucketService.findAll(pageable);
    }

    @Get(":bucketId")
    public async findById(@Param("bucketId") bucketId: string) {
        return this.bucketService.findById(bucketId)
    }

}
