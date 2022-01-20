import { Injectable, Logger } from '@nestjs/common';
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
            .leftJoinAndSelect("albums.artists", "artists")


            .where("artists.id = :artistId", { artistId })
            .offset(pageable.page * pageable.size)
            .limit(pageable.size)
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);

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
        if(createAlbumDto.geniusId) {
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
            // Find by name on genius
            const album = await this.findByTitle(createAlbumDto.title);
            if(album) return { album, artist: null};

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

        return this.albumRepository.findAll(pageable, { where: { title: ILike(query) }, relations: ["artwork"]})
    }

    public async setArtistOfAlbum(album: Album, artist: Artist): Promise<Album> {
        album.artist = artist;
        return this.albumRepository.save(album);
    }

}
