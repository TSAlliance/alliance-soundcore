import { Controller, Get, Param, Query } from '@nestjs/common';
import { AuthenticatedUser } from 'nest-keycloak-connect';

import { Pageable } from 'nestjs-pager';
import { User } from '../user/entities/user.entity';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  public async performSearch(@Query("q") query: string, @AuthenticatedUser() searcher: User) {
    return this.searchService.complexSearch(query, searcher);
  } 

  @Get("/index/byMount/:mountId")
  public async performIndexSearch(@Param("mountId") mountId: string, @Query("q") query: string, @Pageable() pageable: Pageable) {
    return this.searchService.searchIndexInMount(query, mountId, pageable);
  } 
}
