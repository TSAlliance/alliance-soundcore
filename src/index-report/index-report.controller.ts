import { Controller, Get, Param } from '@nestjs/common';
import { IndexReport } from './entities/report.entity';
import { IndexReportService } from './services/index-report.service';

@Controller('index/reports')
export class IndexReportController {
  constructor(private readonly indexReportService: IndexReportService) {}

  @Get(":indexId")
  
  public async findByIndexId(@Param("indexId") indexId: string): Promise<IndexReport> {
    return this.indexReportService.findByIndexId(indexId)
  }
}
