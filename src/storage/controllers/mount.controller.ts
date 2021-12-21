import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { CreateMountDTO } from '../dto/create-mount.dto';
import { UpdateMountDTO } from '../dto/update-mount.dto';
import { StorageMountService } from '../services/mount.service';

@Controller('storage-mounts')
export class StorageMountController {

    // TODO: Add permissions

    constructor(private mountService: StorageMountService){}

    @Post()
    public async create(@Body() createMountDto: CreateMountDTO) {
        return this.mountService.create(createMountDto);
    }

    @Put(":mountId")
    public async update(@Param("mountId") mountId: string, @Body() updateMountDto: UpdateMountDTO) {
        return this.mountService.update(mountId, updateMountDto);
    }

    @Get("/byBucket/:bucketId")
    public async findAllByBucketId(@Param("bucketId") bucketId: string, @Pageable() pageable: Pageable) {
        return this.mountService.findAllByBucketId(bucketId, pageable)
    }

    @Delete(":mountId")
    public async delete(@Param("mountId") mountId: string) {
        return this.mountService.delete(mountId)
    }

}
