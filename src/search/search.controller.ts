import { Controller, Get, Param, Query } from '@nestjs/common';
import { Authentication, IsAuthenticated } from '@tsalliance/sso-nest';
import { Pageable } from 'nestjs-pager';
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

  @Get("/index/byMount/:mountId")
  @IsAuthenticated()
  public async performIndexSearch(@Param("mountId") mountId: string, @Query("q") query: string, @Pageable() pageable: Pageable) {
    return this.searchService.searchIndexInMount(query, mountId, pageable);
  } 
}
