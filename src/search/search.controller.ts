import { Controller, Get, Query } from '@nestjs/common';
import { Pageable, Pagination } from 'nestjs-pager';
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

  @Get("playlists")
  public async searchPlaylists(@Query("q") query: string, @Pagination() pageable: Pageable, @Authentication() authentication: User) {
    return this.searchService.searchPlaylists(query, pageable, authentication);
  }

}
