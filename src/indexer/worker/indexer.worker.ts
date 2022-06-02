import { Logger } from "@nestjs/common";
import { DoneCallback, Job } from "bull";
import { ArtistService } from "../../artist/artist.service";
import { ArtistRepository } from "../../artist/repositories/artist.repository";
import { TYPEORM_CONNECTION_INDEXER } from "../../constants";
import { File } from "../../file/entities/file.entity";
import { SongRepository } from "../../song/repositories/song.repository";
import { SongService } from "../../song/song.service";
import { DBWorker } from "../../utils/workers/worker.util";
import { IndexerProcessDTO } from "../dtos/indexer-process.dto";

import fs from "fs";
import path from "path";
import NodeID3 from "node-id3";
import ffprobe from 'ffprobe';
import ffprobeStatic from "ffprobe-static";
import { ID3TagsDTO } from "../../song/dtos/id3-tags.dto";
import { Artist } from "../../artist/entities/artist.entity";
import { Song } from "../../song/entities/song.entity";
import { AlbumRepository } from "../../album/repositories/album.repository";
import { AlbumService } from "../../album/album.service";
import { Album } from "../../album/entities/album.entity";

const logger = new Logger("MountWorker");

export default function (job: Job<IndexerProcessDTO>, dc: DoneCallback) {
    // 
    const startTime = Date.now();
    const mount = job.data.file.mount;
    const file = job.data.file;
    const filepath = path.join(mount.directory, file.directory, file.name);

    console.log(filepath);

    DBWorker.establishConnection(TYPEORM_CONNECTION_INDEXER, job.data.workerOptions).then((connection) => {
        const songRepo = connection.getCustomRepository(SongRepository);
        const artistRepo = connection.getCustomRepository(ArtistRepository);
        const albumRepo = connection.getCustomRepository(AlbumRepository);

        const songService = new SongService(songRepo);
        const artistService = new ArtistService(artistRepo);
        const albumService = new AlbumService(albumRepo);

        // Check if file is accessible by the process
        fs.access(filepath, (err) => {
            if(err) {
                reportError(job, err, dc);
                return;
            }

            // Read ID3 Tags from mp3 files.
            readMp3Tags(filepath).then(async (id3Tags) => {
                console.log(id3Tags);

                const artists: Artist[] = await Promise.all(id3Tags.artists.map((artist) => artistService.findOrCreateByName(artist.name)))
                const album: Album = await albumService.findOrCreateByNameAndArtist(id3Tags.album, artists[0]);

                console.log(album.name);
                
                reportSuccess(startTime, job, null, dc);
            }).catch((error) => {
                reportError(job, error, dc);
            })
        })
        
    })


}

/**
 * Read ID3 Tags of a specified mp3 file.
 * @param filepath Path to the mp3 file
 * @returns ID3TagsDTO
 */
async function readMp3Tags(filepath: string): Promise<ID3TagsDTO> {
    const id3Tags = NodeID3.read(fs.readFileSync(filepath));

    // Get duration in seconds
    const probe = await ffprobe(filepath, { path: ffprobeStatic.path })
    const durationInSeconds = Math.round(probe.streams[0].duration || 0);

    // Get artists
    const artists: string[] = [];
    if(id3Tags.artist) {
        artists.push(...(id3Tags.artist.split("/") || []))
        for(const index in artists) {
            artists.push(...artists[index].split(",").map((name) => name.trim()))
            artists.splice(parseInt(index), 1)
        }
    }
    
    // Get artwork buffer
    let artworkBuffer: Buffer = undefined;
    if(id3Tags?.image && id3Tags.image["imageBuffer"]) {
        artworkBuffer = id3Tags.image["imageBuffer"]
    }

    // Build result DTO
    const result: ID3TagsDTO = {
        title: id3Tags.title.trim(),
        duration: durationInSeconds,
        artists: artists.map((name) => ({ name })),
        album: id3Tags.album.trim(),
        artwork: artworkBuffer,
        orderNr: parseInt(id3Tags.trackNumber?.split("/")?.[0]) || undefined
    }

    const context = {...result};
    context.artwork = undefined
    return result
}

function reportSuccess(startTime: number, job: Job<IndexerProcessDTO>, result: Song, dc: DoneCallback) {
    logger.log(`Successfully created metadata from file '${job.data.file.name}'. Took ${Date.now()-startTime}ms`);
    dc(null, result);
}

function reportError(job: Job<IndexerProcessDTO>, error: Error, dc: DoneCallback) {
    logger.error(`Failed creating metadata from file '${job.data.file.name}': ${error.message}`);
    dc(error, []);
}