import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { IsAuthenticated } from '@tsalliance/rest';
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
  @IsAuthenticated()
  public async findAllByBucket(@Param("bucketId") bucketId: string, @Pageable() pageable: Pageable): Promise<Page<Mount>> {
    return this.mountService.findPageByBucketId(bucketId, pageable);
  }

  @Put(":mountId")
  @IsAuthenticated()
  public async updateMount(@Param("mountId") mountId: string, @Body() updateMountDto: UpdateMountDTO): Promise<Mount> {
    return this.mountService.update(mountId, updateMountDto)
  }

  @Post()
  @IsAuthenticated()
  public async createMount(@Body() createMountDto: CreateMountDTO): Promise<Mount> {
    return this.mountService.create(createMountDto)
  }

  @Delete(":mountId")
  @IsAuthenticated()
  public async deleteMount(@Param("mountId") mountId: string): Promise<DeleteResult> {
    return this.mountService.delete(mountId)
  }

}
