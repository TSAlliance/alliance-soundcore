import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { Artist } from '../artist/entities/artist.entity';
import { GeniusArtistDTO } from '../genius/dtos/genius-artist.dto';
import { GeniusAlbumResponse } from '../genius/dtos/genius-response.dto';
import { GeniusService } from '../genius/services/genius.service';
import { User } from '../user/entities/user.entity';
import { CreateAlbumDTO } from './dto/create-album.dto';
import { Album } from './entities/album.entity';
import { AlbumRepository } from './repositories/album.repository';

@Injectable()
export class AlbumService {
    private logger: Logger = new Logger(AlbumService.name);

    constructor(
        private albumRepository: AlbumRepository,
        private geniusService: GeniusService
    ) {}

    public async findProfilesByArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.albumRepository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoinAndSelect("album.banner", "banner")
            .leftJoin("album.artist", "artist")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "artwork.accentColor", "banner.id", "banner.accentColor", "artist.id", "artist.name"])
            .where("artist.id = :artistId", { artistId })
            .orWhere("artist.slug = :artistId", { artistId })

            .orderBy("album.released", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findFeaturedWithArtist(artistId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.albumRepository.createQueryBuilder("album")
            .leftJoin("album.artwork", "artwork")
            .leftJoin("album.banner", "banner")
            .leftJoin("album.artist", "artist")
            .leftJoin("album.songs", "song")
            .leftJoin("song.artists", "featuredArtist", "featuredArtist.id != artist.id AND (featuredArtist.id = :featArtistId OR featuredArtist.slug = :featArtistId)", { featArtistId: artistId })

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "artwork.accentColor", "banner.id", "banner.accentColor", "artist.id", "artist.name", "featuredArtist.id", "featuredArtist.name"])

            .where("featuredArtist.id = :featArtistId OR featuredArtist.slug = :slug", { featArtistId: artistId, slug: artistId })
            .orderBy("album.released", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .getManyAndCount();        

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findRecommendedProfilesByArtist(artistId: string, exceptAlbumIds: string | string[] = [], authentication?: User): Promise<Page<Album>> {
        if(!exceptAlbumIds) exceptAlbumIds = []
        if(!Array.isArray(exceptAlbumIds)) {
            exceptAlbumIds = [ exceptAlbumIds ];
        }

        let qb = await this.albumRepository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoinAndSelect("album.banner", "banner")
            .leftJoinAndSelect("album.artist", "artist")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artist.id", "artist.name"])
            .limit(10);

        if(exceptAlbumIds && exceptAlbumIds.length > 0) {
            qb = qb.where("album.id NOT IN(:except)", { except: exceptAlbumIds || [] })
        }
        qb = qb.andWhere("(artist.id = :artistId OR artist.slug = :artistId)", { artistId })

        const result = await qb.getMany();
        return Page.of(result, 10, 0);
    }

    public async findByGenre(genreId: string, pageable: Pageable, authentication?: User): Promise<Page<Album>> {
        const result = await this.albumRepository.createQueryBuilder("album")
            .leftJoin("album.artist", "artist")
            .leftJoin("album.artwork", "artwork")
            .leftJoin("album.songs", "song")
            .leftJoin("song.genres", "genre")

            .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

            .addSelect(["artwork.id", "artwork.accentColor", "artist.id", "artist.name"])

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .where("genre.id = :genreId OR genre.slug = :genreId", { genreId })
            .getMany()

        return Page.of(result, result.length, pageable.page);
    }

    /**
     * Find album by its id including all information required to display the album
     * page on the frontend
     * @param albumId Album's id
     * @returns Album
     */
    public async findProfileById(albumId: string, authentication?: User): Promise<Album> {
        const result = await this.albumRepository.createQueryBuilder("album")
                .where("album.id = :albumId", { albumId })
                .orWhere("album.slug = :albumId", { albumId })

                // Relation for counting and summing up duration
                .leftJoin("album.songs", "song")
                
                // This is for relations
                .leftJoinAndSelect("album.artwork", "artwork")
                .leftJoinAndSelect("album.banner", "banner")
                .leftJoinAndSelect("album.distributor", "distributor")
                .leftJoinAndSelect("distributor.artwork", "distrArtwork")
                .leftJoinAndSelect("album.label", "label")
                .leftJoinAndSelect("label.artwork", "labelArtwork")
                .leftJoinAndSelect("album.publisher", "publisher")
                .leftJoinAndSelect("publisher.artwork", "publisherArtwork")
                .leftJoinAndSelect("album.artist", "artist")
                .leftJoinAndSelect("artist.artwork", "albumArtwork")

                .loadRelationCountAndMap("album.liked", "album.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

                .groupBy("album.id")

                // Counting the songs
                .addSelect('COUNT(song.id)', 'songsCount')

                // SUM up the duration of every song to get total duration of the playlist
                .addSelect('SUM(song.duration)', 'totalDuration')
                .getRawAndEntities()

        const album = result.entities[0];
        if(!album) throw new NotFoundException("Album not found.")

        const featuredArtists = await this.albumRepository.createQueryBuilder("album")
            .where("album.id = :albumId", { albumId })
            .orWhere("album.slug = :albumId", { albumId })
            .andWhere("artist.id != :artistId", { artistId: album.artist?.id })

            .leftJoin("album.songs", "song")
            .leftJoinAndSelect("song.artists", "artist")
            .leftJoinAndSelect("artist.artwork", "artwork")
            
            .select(["artist.id", "artist.name", "artwork.id", "artwork.accentColor"])
            .distinct()
            .getRawAndEntities()

        /*album.featuredArtists = featuredArtists.raw.map((a) => ({
            id: a.artist_id,
            name: a.artist_name,
            artwork: {
                id: a.artwork_id,
                accentColor: a.artwork_accentColor
            }
        } as Artist))*/

        album.totalDuration = parseInt(result.raw[0].totalDuration);
        album.songsCount = parseInt(result.raw[0].songsCount)

        return album
    }

    /**
     * Find an album by its titel that also has a specific primary artist.
     * @param title Title of the album to lookup
     * @param artist Primary album artist
     * @returns Album
     */
    public async findByTitleAndArtist(title: string, artist: Artist): Promise<Album> {
        return await this.albumRepository.findOne({ where: { name: title, artist: { id: artist.id } }, relations: ["artist", "artwork", "distributor", "label", "publisher", "banner"]});
    }

    public async findByGeniusId(geniusId: string): Promise<Album> {
        return await this.albumRepository.findOne({ where: { geniusId }, relations: ["artist"]});
    }

    private async create(createAlbumDto: CreateAlbumDTO): Promise<Album> {
        const album = new Album();
        album.geniusId = createAlbumDto.geniusId;
        album.name = createAlbumDto.title;
        album.released = createAlbumDto.released;
        album.artist = createAlbumDto.artist;
        album.description = createAlbumDto.description;
        album.distributor = createAlbumDto.distributor;
        album.label = createAlbumDto.label;
        album.publisher = createAlbumDto.publisher;

        return this.albumRepository.save(album)
    }

    public async createIfNotExists(createAlbumDto: CreateAlbumDTO): Promise<{ album: Album, artist: GeniusArtistDTO}> {
        createAlbumDto.title = createAlbumDto.title?.replace(/^[ ]+|[ ]+$/g,'')

        // Check if dto contains a geniusId
        if(createAlbumDto.geniusId) {
            // If geniusId was found on dto, proceed looking up that id on the
            // Genius.com api to retrieve additional data
            const album = await this.findByGeniusId(createAlbumDto.geniusId);
            if(album) return { album, artist: null };

            // Find by genius id.
            // This returns created album entry and the artist that was found on genius
            return this.geniusService.fetchResourceByIdAndType<GeniusAlbumResponse>("album", createAlbumDto.geniusId).then(async (response) => {
                if(!response.album) return { album: null, artist: null };

                return await this.albumRepository.save({
                    geniusId: createAlbumDto.geniusId,
                    title: response.album.name,
                    description: response.album.description_preview,
                    released: response.album.release_date
                }).then((album) => {
                    return { album, artist: response.album.artist }
                }).catch(() => {
                    return { album: null, artist: null }
                })
            }).catch(() => {
                return { album: null, artist: null }
            })
        } else {
            // There was no geniusId provided
            // So we have to search a fitting resourceId by ourselves
            // by sending a search request providing the title we are looking for.
            // But first we can check if the title already exists in the database.
            const album = await this.findByTitleAndArtist(createAlbumDto.title, createAlbumDto.artist);
            if(album) return { album, artist: null };

            return this.create(createAlbumDto).then((album) => {
                return this.geniusService.findAndApplyAlbumInfo(album, createAlbumDto.geniusSearchArtists, createAlbumDto.mountForArtworkId).then(async (result) => {
                    album.hasGeniusLookupFailed = false;
                    
                    await this.albumRepository.save(album)
                    return { album, artist: result.artist };
                }).catch(() => {
                    this.logger.warn("Could not find information for album '" + createAlbumDto.title + "'")
                    album.hasGeniusLookupFailed = true;
                    this.albumRepository.save(album)
                    return {album, artist: null};
                })
            })
        }
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Album>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        let qb = this.albumRepository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoin("album.artist", "artist")

            .limit(pageable.size)
            .offset(pageable.page * pageable.size)

            .addSelect(["artist.id", "artist.name", "artist.slug"])
            .where("album.title LIKE :query", { query });

        if(query == "%") {
            qb = qb.orderBy("rand()");
        }

        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], pageable.page);
    }

    public async setArtistOfAlbum(album: Album, artist: Artist): Promise<Album> {
        album.artist = artist;
        return this.albumRepository.save(album);
    }

}
