import { Body, Controller, Post } from '@nestjs/common';
import { AuthenticatedUser } from 'nest-keycloak-connect';

import { User } from '../user/entities/user.entity';
import { CreateImportDTO } from './dtos/create-import.dto';
import { CreateSpotifyImportDTO } from './dtos/create-spotify.dto';
import { ImportService } from './import.service';

@Controller('imports')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post()
  
  public async createImport(@Body() createImportDto: CreateImportDTO, @AuthenticatedUser() importer: User) {
    return this.importService.createImport(createImportDto, importer);
  }

  @Post("spotify")
  
  public async createSpotifyImport(@Body() createImportDto: CreateSpotifyImportDTO, @AuthenticatedUser() importer: User) {
    return this.importService.createSpotifyImport(createImportDto, importer);
  }
}
