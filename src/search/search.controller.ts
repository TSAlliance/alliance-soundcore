import { Controller, Get, Query } from '@nestjs/common';
import { Authentication, IsAuthenticated } from '@tsalliance/sso-nest';
import { User } from '../user/entities/user.entity';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @IsAuthenticated()
  public async performSearch(@Query("q") query: string, @Authentication() searcher: User) {
    return this.searchService.complexSearch(query, searcher);
  } 
}
