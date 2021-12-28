import { Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Authentication, IsAuthenticated } from '@tsalliance/rest';
import { SSOUser } from '@tsalliance/sso-nest';
import { Index } from '../index/entities/index.entity';
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
  @IsAuthenticated()
  @UseInterceptors(FileInterceptor("file"))
  public async uploadAudio(@UploadedFile() file: Express.Multer.File, @Authentication() uploader: SSOUser): Promise<Index> {
    return this.uploadService.uploadAudio(file, uploader)
  }

}
