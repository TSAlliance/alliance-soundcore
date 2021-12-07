import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UPLOAD_TMP_DIR } from './services/storage.service';
import { UploadService } from './services/upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("/song")
  @UseInterceptors(FileInterceptor("file", { dest: UPLOAD_TMP_DIR }))
  public async uploadSongFile(@UploadedFile() file: Express.Multer.File) {
    return this.uploadService.create(file);
  }
}
