import { Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from 'nest-keycloak-connect';

import { Index } from '../index/entities/index.entity';
import { User } from '../user/entities/user.entity';
import { Formats } from './dto/formats.dto';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {

  constructor(private readonly uploadService: UploadService) {}

  @Get("formats")
  public async findFormats(): Promise<Formats> {
    return this.uploadService.findSupportedFormats();
  }

  @Post("audio")
  @UseInterceptors(FileInterceptor("file"))
  public async uploadAudio(@UploadedFile() file: Express.Multer.File, @AuthenticatedUser() uploader: User): Promise<Index> {
    return this.uploadService.uploadAudio(file, uploader)
  }

}
