import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Authentication, IsAuthenticated } from '@tsalliance/rest';
import { SSOUser } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { UploadedAudioFile } from './entities/uploaded-file.entity';
import { UPLOAD_TMP_DIR } from '../storage/storage.service';
import { UploadService } from './services/upload.service';

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("/song")
  @IsAuthenticated()
  @UseInterceptors(FileInterceptor("file", { dest: UPLOAD_TMP_DIR }))
  public async uploadSongFile(@UploadedFile() file: Express.Multer.File, @Authentication() uploader: SSOUser) {
    return this.uploadService.create(file, uploader);
  }

  @Get("/byUploader/:uploaderId")
  public async findAllByUploaderId(@Param("uploaderId") uploaderId: string, @Pageable() pageable: Pageable): Promise<Page<UploadedAudioFile>> {
    return this.uploadService.findAllByUploaderIdWithRelations(uploaderId, pageable);
  }
}
