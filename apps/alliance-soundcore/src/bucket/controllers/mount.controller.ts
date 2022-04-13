import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { DeleteResult } from 'typeorm';
import { CreateMountDTO } from '../dto/create-mount.dto';
import { UpdateMountDTO } from '../dto/update-mount.dto';
import { Mount } from '../entities/mount.entity';
import { MountService } from '../services/mount.service';

@Controller('mounts')
export class MountController {
  constructor(private readonly mountService: MountService) {}

  @Get("/byBucket/:bucketId")
  public async findAllByBucket(@Param("bucketId") bucketId: string, @Pageable() pageable: Pageable): Promise<Page<Mount>> {
    return this.mountService.findPageByBucketId(bucketId, pageable);
  }

  @Get(":mountId")
  public async findById(@Param("mountId") mountId: string): Promise<Mount> {
    return this.mountService.findById(mountId);
  }

  @Put(":mountId")
  public async updateMount(@Param("mountId") mountId: string, @Body() updateMountDto: UpdateMountDTO): Promise<Mount> {
    return this.mountService.update(mountId, updateMountDto)
  }

  @Post()
  public async createMount(@Body() createMountDto: CreateMountDTO): Promise<Mount> {
    return this.mountService.create(createMountDto)
  }

  @Delete(":mountId")
  public async deleteMount(@Param("mountId") mountId: string): Promise<DeleteResult> {
    return this.mountService.delete(mountId)
  }

}
