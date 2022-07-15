import { Controller, Get, Query } from '@nestjs/common';
import { Pageable, Pagination } from 'nestjs-pager';
import { Authentication } from '../authentication/decorators/authentication.decorator';
import { User } from '../user/entities/user.entity';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  public async performSearch(@Query("q") query: string, @Authentication() searcher: User) {
    return this.service.complexSearch(query, searcher);
  } 

  @Get("playlists")
  public async searchPlaylists(@Query("q") query: string, @Pagination() pageable: Pageable, @Authentication() authentication: User) {
    return this.service.searchPlaylists(query, pageable, authentication);
  }

  @Get("users")
  public async searchUsers(@Query("q") query: string, @Pagination() pageable: Pageable) {
    return this.service.searchUsers(query, pageable);
  }

  @Get("artists")
  public async searchArtists(@Query("q") query: string, @Pagination() pageable: Pageable) {
    return this.service.searchArtists(query, pageable);
  }

}
