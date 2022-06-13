import { Controller, Get, Query } from '@nestjs/common';
import { Authentication } from '../authentication/decorators/authentication.decorator';
import { User } from '../user/entities/user.entity';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  public async performSearch(@Query("q") query: string, @Authentication() searcher: User) {
    return this.searchService.complexSearch(query, searcher);
  } 

}
