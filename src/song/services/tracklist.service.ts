import { Injectable } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { SelectQueryBuilder } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Song } from '../entities/song.entity';
import { Tracklist, TracklistType } from '../entities/tracklist.entity';
import { SongService } from '../song.service';

@Injectable()
export class TracklistService {

    constructor(
        private readonly songService: SongService
    ) {}

    /**
     * Find a list of song ids by an artist.
     * @param artistId Artist's id
     * @param authentication User authentication object
     * @returns Tracklist
     */
    public async findListByArtist(artistId: string, authentication?: User): Promise<Tracklist> {
        const result = this.buildFindByArtistQuery(artistId, "song", null, authentication).select(["song.id"]).getManyAndCount();
        return new Tracklist(result[1], TracklistType.ARTIST, result[0]);
    }

    /**
     * Find a page of metadata of the tracklist of an artist.
     * @param artistId Artist's id
     * @param pageable Page settings
     * @param authentication User authentication object
     * @returns Page<Song>
     */
    public async findMetaByArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Song>> {
        const baseQuery = await this.buildFindByArtistQuery(artistId, "song", pageable, authentication)
        
        const result = await baseQuery.getRawAndEntities();
        const totalElements = await baseQuery.getCount();
        return Page.of(result.entities.map((song, index) => {
            song.streamCount = result.raw[index]?.streamCount || 0
            return song;
        }), totalElements, pageable.page);   
    }

    /**
     * Find a list of song ids by an artist.
     * @param artistId Artist's id
     * @param authentication User authentication object
     * @returns Tracklist
     */
    public async findListByArtistTop(artistId: string, authentication?: User): Promise<Tracklist> {
        const result = this.buildFindByArtistTopQuery(artistId, "song", authentication).select(["song.id"]).getManyAndCount();
        return new Tracklist(result[1], TracklistType.ARTIST, result[0]);
    }

    /**
     * Find a page of metadata of the tracklist of an artist.
     * @param artistId Artist's id
     * @param pageable Page settings
     * @param authentication User authentication object
     * @returns Page<Song>
     */
    public async findMetaByArtistTop(artistId: string, authentication?: User): Promise<Page<Song>> {
        const baseQuery = await this.buildFindByArtistTopQuery(artistId, "song", authentication)
        
        const result = await baseQuery.getRawAndEntities();
        const totalElements = await baseQuery.getCount();
        return Page.of(result.entities.map((song, index) => {
            song.streamCount = result.raw[index]?.streamCount || 0
            return song;
        }), totalElements, 0);   
    }

    /**
     * Find a list of song ids by an album.
     * @param albumId Id of the album
     * @param pageable Page settings
     * @param authentication User authentication object
     * @returns Tracklist
     */
    public async findListByAlbum(albumId: string, authentication?: User): Promise<Tracklist> {
        const result = await this.buildFindByAlbumQuery(albumId, "song", null, authentication).select(["song.id"]).getMany();
        return new Tracklist(result.length, TracklistType.ALBUM, result);    
    }

    /**
     * Find a page of metadata of the tracklist of an album.
     * @param albumId Id of the album
     * @param pageable Page settings
     * @param authentication User authentication object
     * @returns Page<Song>
     */
    public async findMetaByAlbum(albumId: string, pageable: Pageable, authentication?: User): Promise<Page<Song>> {
        const baseQuery = await this.buildFindByAlbumQuery(albumId, "song", pageable, authentication)
            
        const result = await baseQuery.getRawAndEntities();
        const totalElements = await baseQuery.getCount();
        return Page.of(result.entities.map((song, index) => {
            song.streamCount = result.raw[index]?.streamCount || 0
            return song;
        }), totalElements, pageable.page);    
    }

    /**
     * Find a list of song ids by an album.
     * @param playlistId Id of the album
     * @param pageable Page settings
     * @param authentication User authentication object
     * @returns Tracklist
     */
    public async findListByPlaylist(playlistId: string, authentication?: User): Promise<Tracklist> {
        const result = await this.buildFindByPlaylistQuery(playlistId, "song", null, authentication).select(["song.id"]).getMany();
        return new Tracklist(result.length, TracklistType.ALBUM, result);    
    }

    /**
     * Find a page of metadata of the tracklist of an playlist.
     * @param playlistId Id of the playlist
     * @param pageable Page settings
     * @param authentication User authentication object
     * @returns Page<Song>
     */
    public async findMetaByPlaylist(playlistId: string, pageable: Pageable, authentication?: User): Promise<Page<Song>> {
        const baseQuery = await this.buildFindByPlaylistQuery(playlistId, "song", pageable, authentication)
            
        const result = await baseQuery.getRawAndEntities();
        const totalElements = await baseQuery.getCount();
        return Page.of(result.entities.map((song, index) => {
            song.streamCount = result.raw[index]?.streamCount || 0
            return song;
        }), totalElements, pageable.page);    
    }



    /**
     * Build the general sql query for findListByArtist()
     * and findMetaByArtist(). This is a shared query to make
     * maintaining the code easier.
     * @param artistId Artist's id
     * @param alias Song entity alias in SQL
     * @param pageable Page settings. Set null for tracklists as this is only required for metadata endpoints.
     * @param authentication 
     * @returns SelectQueryBuilder<Song>
     */
    protected buildFindByArtistQuery(artistId: string, alias: string, pageable?: Pageable, authentication?: User): SelectQueryBuilder<Song> {
        const query = this.songService.buildGeneralQuery(alias, authentication)
            // Get amount of streams
            // TODO: To be optimised using selectAndMap in next TypeORM release
            // If this has landed, this row can actually be moved to buildGeneralQuery()
            .leftJoin('song.streams', 'streams').addSelect("SUM(IFNULL(streams.streamCount, 0)) AS streamCount")

            // Order by date of release or creation in database
            .orderBy('song.released', 'DESC')
            .addOrderBy("song.createdAt", "DESC")

            .where("artist.id = :artistId OR artist.slug = :artistId", { artistId })

        // Add optional page settings
        if(!!pageable) {
            query.skip((pageable.page) * (pageable.size)).take(pageable.size)
        }

        return query;
    }

    /**
     * Build the general sql query for findListByArtistTop()
     * and findMetaByArtistTop(). This is a shared query to make
     * maintaining the code easier.
     * @param artistId Artist's id
     * @param alias Song entity alias in SQL
     * @param authentication 
     * @returns SelectQueryBuilder<Song>
     */
    protected buildFindByArtistTopQuery(artistId: string, alias: string, authentication?: User): SelectQueryBuilder<Song> {
        const query = this.songService.buildGeneralQuery(alias, authentication)
            // Get amount of streams
            // TODO: To be optimised using selectAndMap in next TypeORM release
            // If this has landed, this row can actually be moved to buildGeneralQuery()
            .leftJoin('song.streams', 'streams').addSelect("SUM(IFNULL(streams.streamCount, 0)) AS streamCount")
            .leftJoin("song.likedBy", "likedByAll").addSelect("COUNT(likedByAll.id) AS likedByAllCount")

            // Order by date of release or creation in database
            .orderBy('streamCount', 'DESC')
            .addOrderBy('likedByAllCount', "DESC")

            .groupBy("song.id")
            .limit(5)
            .where("artist.id = :artistId OR artist.slug = :artistId", { artistId })

        return query;
    }

    /**
     * Build the general sql query for findListByAlbum()
     * and findMetaByAlbum(). This is a shared query to make
     * maintaining the code easier.
     * @param albumId Album's id
     * @param alias Song entity alias in SQL
     * @param pageable Page settings. Set null for tracklists as this is only required for metadata endpoints.
     * @param authentication 
     * @returns SelectQueryBuilder<Song>
     */
    protected buildFindByAlbumQuery(albumId: string, alias: string, pageable?: Pageable, authentication?: User): SelectQueryBuilder<Song> {
        const query = this.songService.buildGeneralQuery(alias, authentication)
            // Get amount of streams
            // TODO: To be optimised using selectAndMap in next TypeORM release
            // If this has landed, this row can actually be moved to buildGeneralQuery()
            .leftJoin('song.streams', 'streams').addSelect(["SUM(IFNULL(streams.streamCount, 0)) AS streamCount"])
            // Order songs by album order
            .orderBy("song.order", "ASC")
            .where("album.id = :albumId OR album.slug = :albumId", { albumId })

        // Add optional page settings
        if(!!pageable) {
            query.skip((pageable.page) * (pageable.size)).take(pageable.size)
        }

        return query;
    }

    /**
     * Build the general sql query for findListByPlaylist()
     * and findMetaByPlaylist(). This is a shared query to make
     * maintaining the code easier.
     * @param playlistId Playlist's id
     * @param alias Song entity alias in SQL
     * @param pageable Page settings. Set null for tracklists as this is only required for metadata endpoints.
     * @param authentication 
     * @returns SelectQueryBuilder<Song>
     */
     protected buildFindByPlaylistQuery(playlistId: string, alias: string, pageable?: Pageable, authentication?: User): SelectQueryBuilder<Song> {
        const query = this.songService.buildGeneralQuery(alias, authentication)
            // Get amount of streams
            // TODO: To be optimised using selectAndMap in next TypeORM release
            // If this has landed, this row can actually be moved to buildGeneralQuery()
            .leftJoin('song.streams', 'streams').addSelect(["SUM(IFNULL(streams.streamCount, 0)) AS streamCount"])
            .leftJoin("song.playlists", "item")

            .orderBy("item.order", "ASC")
            .addOrderBy("item.createdAt", "ASC")

            .where("playlist.id = :playlistId OR playlist.slug = :playlistId", { playlistId })

        // Add optional page settings
        if(!!pageable) {
            query.skip((pageable.page) * (pageable.size)).take(pageable.size)
        }

        return query;
    }

}