import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { Index } from './entities/index.entity';
import { IndexService } from './services/index.service';

@Controller('index')
export class IndexController {
  constructor(private readonly indexService: IndexService) {}

  @Get(":indexId")
  
  public async findById(@Param("indexId") indexId: string): Promise<Index> {
    return this.indexService.findById(indexId)
  }

  @Post("/reindex/:indexId")
  
  public async reindex(@Param("indexId") indexId: string): Promise<void> {
    return this.indexService.reindex(indexId).then(() => {
      return;
    })
  }

  @Get("/byUploader/:uploaderId")
  
  public async findByUploaderId(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<Index>> {
    return this.indexService.findPageByUploader(uploaderId, pageable)
  }

  @Delete(":indexId")
  
  public async deleteById(@Param("indexId") indexId: string) {
    return this.indexService.deleteById(indexId);
  }

  @Get("/byMount/:mountId")
  
  public async findPageByMount(@Param("mountId") mountId: string, @Pageable() pageable: Pageable) {
    return this.indexService.findByMountId(mountId, pageable);
  }
}
