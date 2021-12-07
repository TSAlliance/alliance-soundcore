import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createReadStream, readFileSync } from 'fs';
import * as NodeID3 from 'node-id3';
import { DeleteResult, UpdateResult } from 'typeorm';
import { UploadedFile } from '../upload/entities/uploaded-file.entity';
import { UploadService } from '../upload/services/upload.service';
import { CreateSongDTO } from './dto/create-song.dto';
import { UpdateSongDTO } from './dto/update-song.dto';
import { Song } from './entities/song.entity';
import { SongRepository } from './repositories/song.repository';

import * as ffprobe from "ffprobe"
import * as ffprobeStatic from "ffprobe-static"

@Injectable()
export class SongService {

    constructor(
        @Inject(forwardRef(() => UploadService)) private uploadService: UploadService,
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

    public async update(id: string, updateSongDto: UpdateSongDTO): Promise<UpdateResult> {
        return this.songRepository.update({ id }, updateSongDto);
    }

    /**
     * Create new song entry in database from metadata found in buffer.
     * @param file Buffer
     * @param uploadedFile UploadedFile Entity
     * @returns Song
     */
    public async createMetadataFromBuffer(filepath: string, uploadedFile: UploadedFile): Promise<Song> {
        const id3Tags = NodeID3.read(readFileSync(filepath));

        const probe = await ffprobe(filepath, { path: ffprobeStatic.path })
        const durationInSeconds = Math.round(probe.streams[0].duration || 0);

        const song = await this.create({ 
            title: id3Tags.title,
            durationInSeconds,
            file: uploadedFile
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
