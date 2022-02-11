import { Controller, Get, Param, Post } from '@nestjs/common';
import { IsAuthenticated } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { Index } from './entities/index.entity';
import { IndexService } from './services/index.service';

@Controller('index')
export class IndexController {
  constructor(private readonly indexService: IndexService) {}

  @Get(":indexId")
  @IsAuthenticated()
  public async findById(@Param("indexId") indexId: string): Promise<Index> {
    return this.indexService.findById(indexId)
  }

  @Get("/byUploader/:uploaderId")
  @IsAuthenticated()
  public async findByUploaderId(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<Index>> {
    return this.indexService.findPageByUploader(uploaderId, pageable)
  }

  @Post(":indexId/ignore")
  @IsAuthenticated()
  public async setIndexToIgnored(@Param("indexId") indexId: string) {
    return this.indexService.setIgnored(indexId);
  }

  @Get("/byMount/:mountId")
  @IsAuthenticated()
  public async findPageByMount(@Param("mountId") mountId: string, @Pageable() pageable: Pageable) {
    return this.indexService.findPagebyMount(mountId, pageable);
  }
}
