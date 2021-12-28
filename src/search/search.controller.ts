import { Controller, Get, Query } from '@nestjs/common';
import { Pageable } from 'nestjs-pager';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  public async performSearch(@Query("q") query: string, @Pageable() pageable: Pageable) {
    return this.searchService.complexSearch(query, pageable);
  } 
}
