import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult, FindManyOptions, ILike, In, Like, UpdateResult } from 'typeorm';
import { UploadService } from '../upload/services/upload.service';
import { CreateSongDTO } from './dto/create-song.dto';
import { UpdateSongDTO } from './dto/update-song.dto';
import { Song } from './entities/song.entity';
import { SongRepository } from './repositories/song.repository';

import { StorageService } from '../upload/services/storage.service';
import { Page, Pageable } from 'nestjs-pager';

@Injectable()
export class SongService {

    constructor(
        @Inject(forwardRef(() => UploadService)) private uploadService: UploadService,
        private storageService: StorageService,
        private songRepository: SongRepository
    ) { }

    public async findById(id: string): Promise<Song> {
        return this.songRepository.findOne(id);
    }

    public async findByIdWithRelations(id: string): Promise<Song> {
        return this.songRepository.findOne(id, { relations: ["file"] });
    }

    public async create(createSongDto: CreateSongDTO): Promise<Song> {
        return this.songRepository.save(createSongDto);
    }

    public async findBySearchQuery(query: string, pageable: Pageable): Promise<Page<Song>> {
        if(!query) query = ""
        query = query.replace(/\s/g, '%');

        const result = await this.songRepository.findAll(pageable, {
            where: {
                title: ILike(`%${query}%`)
            },
            relations: ["artists"]
        })

        return result;
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
        const song = await this.create({ 
            ...await this.storageService.readMetadataFromAudioFile(filepath),
            file: { id: uploadedFileId }
        });

        return song;
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

        return this.songRepository.delete(id).then((result) => {
            this.uploadService.delete(song.file.id)
            return result;
        });
    }

}
