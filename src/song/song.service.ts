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
import { ArtistService } from '../artist/artist.service';
import { Artist } from '../artist/entities/artist.entity';
import { IndexStatus } from '../index/enum/index-status.enum';
import { GeniusService } from '../genius/services/genius.service';
import { LabelService } from '../label/label.service';
import { PublisherService } from '../publisher/publisher.service';

@Injectable()
export class SongService {

    constructor(
        private geniusService: GeniusService,
        private labelService: LabelService,
        private publisherService: PublisherService,
        private artistService: ArtistService,
        private songRepository: SongRepository
    ){}

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

        // Add artists to song
        // and song to artists
        const artists: Artist[] = await Promise.all(id3tags.artists.map(async (id3Artist) => await this.artistService.createIfNotExists(id3Artist.name))) || [];
        console.log(artists);

        // Save relation with artists
        for(const artist of artists) {
            await this.artistService.addSongToArtist(song, artist);
        }

        index.song = song;
        song.index = index;

        const result = await this.geniusService.findSongInfo(song);
        if(result) {
            if(result.label) song.label = await this.labelService.createIfNotExists(result.label.name, result.label.id)
            if(result.publisher) song.publisher = await this.publisherService.createIfNotExists(result.publisher.name, result.publisher.id)

            song.location = result.recordingLocation;
            song.youtubeUrl = result.youtubeUrl;
            song.released = result.releaseDate;
            song.geniusId = result.geniusId;
        }

        await this.songRepository.save(song);

        // Set status to OK, as this is the last step of the indexing process
        index.status = IndexStatus.ERRORED;
        return index;
    }

    private async readId3Tags(filepath: string): Promise<ID3TagsDTO> {
        const id3Tags = NodeID3.read(fs.readFileSync(filepath));

        // Get duration in seconds
        const probe = await ffprobe(filepath, { path: ffprobeStatic.path })
        const durationInSeconds = Math.round(probe.streams[0].duration || 0);

        // Get artists
        const artists = id3Tags.artist.split("/") || []
        for(const index in artists) {
            artists.push(...artists[index].split(","))
            artists.splice(parseInt(index), 1)
        }

        console.log(id3Tags.genre)

        // Get artwork buffer
        // const artworkBuffer: Buffer = id3Tags.image["imageBuffer"];
    
        return {
            title: id3Tags.title,
            duration: durationInSeconds,
            artists: artists.map((name) => ({ name })),
            // artworkBuffer: sharp(artworkBuffer).jpeg({ quality: 90 }).toBuffer()
        }
    }

}
