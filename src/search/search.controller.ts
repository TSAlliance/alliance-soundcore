import { Controller, Get, Query } from '@nestjs/common';
import { IsAuthenticated } from '@tsalliance/sso-nest';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @IsAuthenticated()
  public async performSearch(@Query("q") query: string) {
    return this.searchService.complexSearch(query);
  } 
}
