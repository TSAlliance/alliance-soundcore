import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { ILike } from 'typeorm';
import { Artist } from '../artist/entities/artist.entity';
import { GeniusArtistDTO } from '../genius/dtos/genius-artist.dto';
import { GeniusAlbumResponse } from '../genius/dtos/genius-response.dto';
import { GeniusService } from '../genius/services/genius.service';
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

    public async findProfilesByArtist(artistId: string, pageable: Pageable): Promise<Page<Album>> {
        const result = await this.albumRepository.createQueryBuilder("albums")
            .leftJoinAndSelect("albums.artwork", "artwork")
            .leftJoinAndSelect("albums.banner", "banner")
            .leftJoinAndSelect("albums.artist", "artist")

            .where("artist.id = :artistId", { artistId })
            .orderBy("albums.released", "DESC")
            .addOrderBy("albums.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findFeaturedWithArtist(artistId: string, pageable: Pageable): Promise<Page<Album>> {
        const result = await this.albumRepository.createQueryBuilder("album")
            .leftJoin("album.artwork", "artwork")
            .leftJoin("album.banner", "banner")
            .leftJoin("album.artist", "artist")
            .leftJoin("album.songs", "song")
            .leftJoin("song.artists", "featuredArtist")

            .select(["album.id", "album.title", "album.released", "artwork.id", "artwork.accentColor", "banner.id", "banner.accentColor", "artist.id", "artist.name", "featuredArtist.id", "featuredArtist.name"])

            .where("featuredArtist.id = :artistId", { artistId })
            .andWhere("artist.id != :artistId", { artistId })
            .orderBy("album.released", "DESC")
            .addOrderBy("album.createdAt", "DESC")

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findRecommendedProfilesByArtist(artistId: string, exceptAlbumIds: string | string[] = []): Promise<Page<Album>> {
        if(!Array.isArray(exceptAlbumIds)) {
            exceptAlbumIds = [ exceptAlbumIds ];
        }

        const result = await this.albumRepository.createQueryBuilder("album")
            .leftJoinAndSelect("album.artwork", "artwork")
            .leftJoinAndSelect("album.banner", "banner")
            .leftJoinAndSelect("album.artist", "artist")
            .where("artist.id = :artistId", { artistId })
            .andWhere("album.id NOT IN(:except)", { except: exceptAlbumIds })
            .select(["album.id", "album.title", "album.released", "artist.id", "artist.name", "artwork.id", "artwork.accentColor"])
            .limit(10)
            .getMany();

        return Page.of(result, 10, 0);
    }

    public async findByGenre(genreId: string, pageable: Pageable): Promise<Page<Album>> {
        const result = await this.albumRepository.createQueryBuilder("album")
            .leftJoin("album.artist", "artist")
            .leftJoin("album.artwork", "artwork")
            .leftJoin("album.songs", "song")
            .leftJoin("song.genres", "genre")

            .select(["album.id", "album.title", "album.released", "artwork.id", "artwork.accentColor", "artist.id", "artist.name"])

            // Pagination
            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable.size || 30)

            .where("genre.id = :genreId", { genreId })
            .getMany()

        return Page.of(result, result.length, pageable.page);
    }

    /**
     * Find album by its id including all information required to display the album
     * page on the frontend
     * @param albumId Album's id
     * @returns Album
     */
    public async findProfileById(albumId: string): Promise<Album> {
        const result = await this.albumRepository.createQueryBuilder("album")
                .where("album.id = :albumId", { albumId })

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

                // Counting the songs
                .addSelect('COUNT(song.id)', 'songsCount')

                // SUM up the duration of every song to get total duration of the playlist
                .addSelect('SUM(song.duration)', 'totalDuration')
                .getRawAndEntities()

        const album = result.entities[0];
        if(!album) throw new NotFoundException("Album not found.")

        const featuredArtists = await this.albumRepository.createQueryBuilder("album")
            .leftJoin("album.songs", "song")
            .leftJoinAndSelect("song.artists", "artist")
            .leftJoinAndSelect("artist.artwork", "artwork")

            .where("album.id = :albumId", { albumId })
            .andWhere("artist.id != :artistId", { artistId: album.artist?.id })
            .select(["artist.id", "artist.name", "artwork.id", "artwork.accentColor"])
            .distinct()
            .getRawAndEntities()

        album.featuredArtists = featuredArtists.raw.map((a) => ({
            id: a.artist_id,
            name: a.artist_name,
            artwork: {
                id: a.artwork_id,
                accentColor: a.artwork_accentColor
            }
        } as Artist))

        album.totalDuration = parseInt(result.raw[0].totalDuration);
        album.songsCount = parseInt(result.raw[0].songsCount)

        return album
    }

    public async findByTitle(title: string): Promise<Album> {
        return await this.albumRepository.findOne({ where: { title }});
    }

    public async findByGeniusId(geniusId: string): Promise<Album> {
        return await this.albumRepository.findOne({ where: { geniusId }, relations: ["artist"]});
    }

    public async existsByTitle(title: string): Promise<boolean> {
        return !!(await this.findByTitle(title));
    }

    private async create(createAlbumDto: CreateAlbumDTO): Promise<Album> {
        return this.albumRepository.save({
            geniusId: createAlbumDto.geniusId,
            title: createAlbumDto.title,
            released: createAlbumDto.released,
            artists: createAlbumDto.artists,
            distributor: createAlbumDto.distributor,
            label: createAlbumDto.label,
            publisher: createAlbumDto.publisher
        })
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
            const album = await this.findByTitle(createAlbumDto.title);
            if(album) return { album, artist: null };

            return this.create(createAlbumDto).then((album) => {
                return this.geniusService.findAndApplyAlbumInfo(album, createAlbumDto.artists, createAlbumDto.mountForArtworkId).then(async (result) => {
                    await this.albumRepository.save(album)
    
                    return { album, artist: result.artist };
                }).catch(() => {
                    this.logger.warn("Could not find information for album '" + createAlbumDto.title + "'")
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

        return this.albumRepository.findAll(pageable, { where: { title: ILike(query) }, relations: ["artwork", "artist"]})
    }

    public async setArtistOfAlbum(album: Album, artist: Artist): Promise<Album> {
        album.artist = artist;
        return this.albumRepository.save(album);
    }

}
