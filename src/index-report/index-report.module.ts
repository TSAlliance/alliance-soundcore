import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexReportController } from './index-report.controller';
import { IndexReportRepository } from './repositories/index-report.repository';
import { IndexReportService } from './services/index-report.service';

@Module({
    controllers: [
        IndexReportController
    ],
    providers: [
        IndexReportService
    ],
    imports: [
        TypeOrmModule.forFeature([ IndexReportRepository ])
    ],
    exports: [
        IndexReportService
    ]
})
export class IndexReportModule {}
