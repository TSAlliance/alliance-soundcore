import { Injectable, NotFoundException } from '@nestjs/common';

import NodeID3 from 'node-id3';
import path from 'path';

import ffprobe from 'ffprobe';
import ffprobeStatic from "ffprobe-static";

import fs from 'fs';

import { Index } from '../index/entities/index.entity';
import { CreateSongDTO } from './dtos/create-song.dto';
import { Song } from './entities/song.entity';
import { SongRepository } from './repositories/song.repository';
import { ID3TagsDTO } from './dtos/id3-tags.dto';

@Injectable()
export class SongService {

    constructor(private songRepository: SongRepository){}

    public async create(createSongDto: CreateSongDTO): Promise<Song> {
        return this.songRepository.save(createSongDto);
    }

    public async createFromIndex(index: Index): Promise<Index> {
        const filepath = path.join(index.mount.path, index.filename);
        if(!fs.existsSync(filepath)) throw new NotFoundException("Could not find song file");

        const id3tags = await this.readId3Tags(filepath);
        const song = await this.create({
            duration: id3tags.duration,
            title: id3tags.title
        });

        index.song = song;
        return index;
    }

    private async readId3Tags(filepath: string): Promise<ID3TagsDTO> {
        const id3Tags = NodeID3.read(fs.readFileSync(filepath));

        // Get duration in seconds
        const probe = await ffprobe(filepath, { path: ffprobeStatic.path })
        const durationInSeconds = Math.round(probe.streams[0].duration || 0);

        // Get artists
        /*const artists = id3Tags.artist.split("/")
        for(const index in artists) {
            artists.push(...artists[index].split(","))
            artists.splice(parseInt(index), 1)
        }*/

        // Get artwork buffer
        // const artworkBuffer: Buffer = id3Tags.image["imageBuffer"];
    
        return {
            title: id3Tags.title,
            duration: durationInSeconds
            // artists: artists.map((name) => ({ name }) as Artist),
            // artworkBuffer: sharp(artworkBuffer).jpeg({ quality: 90 }).toBuffer()
        }
    }

}
