import { Controller, Get, Param } from '@nestjs/common';
import { IsAuthenticated } from '@tsalliance/rest';
import { Page, Pageable } from 'nestjs-pager';
import { Index } from './entities/index.entity';
import { IndexService } from './index.service';

@Controller('index')
export class IndexController {
  constructor(private readonly indexService: IndexService) {}

  @Get("/byUploader/:uploaderId")
  @IsAuthenticated()
  public async findByUploaderId(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<Index>> {
    return this.indexService.findPageByUploader(uploaderId, pageable)
  }
}
