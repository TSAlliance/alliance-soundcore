import { Body, Controller, Post } from '@nestjs/common';
import { Authentication, IsAuthenticated } from '@tsalliance/sso-nest';
import { User } from '../user/entities/user.entity';
import { CreateImportDTO } from './dtos/create-import.dto';
import { CreateSpotifyImportDTO } from './dtos/create-spotify.dto';
import { ImportService } from './import.service';

@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  @IsAuthenticated()
  public async createImport(@Body() createImportDto: CreateImportDTO, @Authentication() importer: User) {
    return this.importService.createImport(createImportDto, importer);
  }

  @Post("spotify")
  @IsAuthenticated()
  public async createSpotifyImport(@Body() createImportDto: CreateSpotifyImportDTO, @Authentication() importer: User) {
    return this.importService.createSpotifyImport(createImportDto, importer);
  }
}
