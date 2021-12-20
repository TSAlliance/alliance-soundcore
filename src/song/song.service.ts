import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, ILike, UpdateResult } from 'typeorm';
import { UploadService } from '../upload/services/upload.service';
import { CreateSongDTO } from './dto/create-song.dto';
import { UpdateSongDTO } from './dto/update-song.dto';
import { Song } from './entities/song.entity';
import { SongRepository } from './repositories/song.repository';

import { StorageService } from '../storage/storage.service';
import { Page, Pageable } from 'nestjs-pager';
import { ArtworkService } from '../artwork/artwork.service';
import { Artist } from '../artist/entities/artist.entity';
import { ArtistService } from '../artist/artist.service';
import { Artwork } from '../artwork/entities/artwork.entity';

@Injectable()
export class SongService {

    constructor(
        @Inject(forwardRef(() => UploadService)) private uploadService: UploadService,
        private storageService: StorageService,
        private artworkService: ArtworkService,
        private artistService: ArtistService,
        private songRepository: SongRepository
    ) { }

    public async findById(id: string): Promise<Song> {
        return this.songRepository.findOne(id);
    }

    public async findByIdWithRelations(id: string): Promise<Song> {
        return this.songRepository.findOne(id, { relations: ["file", "artwork", "artists"] });
    }

    public async create(createSongDto: CreateSongDTO): Promise<Song> {
        return this.songRepository.save(createSongDto);
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Song>> {
        if(!query) query = ""
        query = `%${query.replace(/\s/g, '%')}%`;

        // TODO: Sort by "views"?
        // TODO: Add playlists featuring the song / artist

        // Find song by title or if the artist has similar name
        const result = await this.songRepository.find({
            relations: ["artists", "artwork"],
            join: {
                alias: "song",
                innerJoin: {
                    artists: "song.artists"
                }
            },
            where: qb => {
                qb.where({
                    title: ILike(query)
                }).orWhere("artists.name LIKE :query", { query })
            },
            
        })

        return Page.of(result, result.length, pageable.page);
    }

    public async update(id: string, updateSongDto: UpdateSongDTO): Promise<UpdateResult> {
        return this.songRepository.update({ id }, updateSongDto);
    }

    /**
     * Create new song entry in database from metadata found in buffer.
     * @param file Path to file
     * @param uploadedFile UploadedAudioFile id for metadata context
     * @returns Song
     */
    public async createFromFile(filepath: string, uploadedFileId: string): Promise<Song> {
        const metadataResult = await this.storageService.readMetadataFromAudioFile(filepath);

        const artists: Artist[] = [];

        for(const artist of metadataResult.artists) {
            artists.push(await this.artistService.createIfNotExists({ name: artist.name }))
        }

        // TODO: Add artwork creation here. Currently created in the upload created event

        const song = await this.create({ 
            ...metadataResult,
            artists,
            file: { id: uploadedFileId }
        });
        return this.songRepository.save(song);
    }

    /**
     * Find song by its uploaded file id.
     * @param uploadId Id of the uploaded file.
     * @returns Song
     */
    public async findByUploadId(uploadId: string): Promise<Song> {
        return this.songRepository.findOne({ where: { file: { id: uploadId }}});
    }

    /**
     * Delete song by its id. This also deletes corresponding upload and files.
     * @param id Id of the song.
     * @returns DeleteResult
     */
    public async delete(id: string): Promise<DeleteResult> {
        const song = await this.findByIdWithRelations(id);
        if(!song) throw new NotFoundException("Song not found.");

        // Songs are deleted by deleting corresponding upload
        return this.uploadService.delete(song.file.id);
    }

    public async setArtwork(id: string, artwork: Artwork): Promise<Song> {
        const song: Song = await this.findByIdWithRelations(id);
        if(!song) throw new NotFoundException("Song not found");

        song.artwork = artwork;
        return this.songRepository.save(song);
    }

}
