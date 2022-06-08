import { DoneCallback, Job } from "bull";
import { ArtistService } from "../../artist/artist.service";
import { ArtistRepository } from "../../artist/repositories/artist.repository";
import { TYPEORM_CONNECTION_INDEXER } from "../../constants";
import { SongRepository } from "../../song/repositories/song.repository";
import { SongService } from "../../song/song.service";
import { IndexerProcessDTO, IndexerProcessMode } from "../dtos/indexer-process.dto";

import fs from "fs";
import path from "path";
import { Artist } from "../../artist/entities/artist.entity";
import { Song } from "../../song/entities/song.entity";
import { AlbumRepository } from "../../album/repositories/album.repository";
import { AlbumService } from "../../album/album.service";
import { Album } from "../../album/entities/album.entity";
import { ArtworkRepository } from "../../artwork/repositories/artwork.repository";
import { ArtworkService } from "../../artwork/services/artwork.service";
import { ArtworkStorageHelper } from "../../artwork/helper/artwork-storage.helper";
import { Artwork, ArtworkType } from "../../artwork/entities/artwork.entity";
import { Logger } from "@nestjs/common";
import { DBWorker } from "../../utils/workers/worker.util";
import { FileRepository } from "../../file/repositories/file.repository";
import { FileService } from "../../file/services/file.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FileFlag } from "../../file/entities/file.entity";

const logger = new Logger("IndexerWorker");

export default function (job: Job<IndexerProcessDTO>, dc: DoneCallback) {
    const mount = job.data.file.mount;
    const file = job.data.file;
    const mode = job.data.mode || IndexerProcessMode.SCAN;
    const filepath = path.join(mount.directory, file.directory, file.name);

    DBWorker.instance().then((worker) => {
        worker.establishConnection(TYPEORM_CONNECTION_INDEXER).then((connection) => {
            const songRepo = connection.getCustomRepository(SongRepository);
            const artistRepo = connection.getCustomRepository(ArtistRepository);
            const albumRepo = connection.getCustomRepository(AlbumRepository);
            const artworkRepo = connection.getCustomRepository(ArtworkRepository);
            const fileRepo = connection.getCustomRepository(FileRepository);
    
            const songService = new SongService(songRepo);
            const artistService = new ArtistService(artistRepo, new EventEmitter2());
            const albumService = new AlbumService(albumRepo, new EventEmitter2());
            const artworkService = new ArtworkService(artworkRepo, new ArtworkStorageHelper());
            const fileService = new FileService(fileRepo, new EventEmitter2(), null);
    
            // Check if file is accessible by the process
            fs.access(filepath, (err) => {
                if(err) {
                    reportError(err);
                    return;
                }
    
                // Read ID3 Tags from mp3 files.
                songService.readID3TagsFromFile(filepath).then(async (id3Tags) => {
                    const songTitle = id3Tags.title.trim();
    
                    // Create all artists found in id3tags if they do not already exist in database.
                    const featuredArtists: Artist[] = await Promise.all(id3Tags.artists.map((artist) => artistService.createIfNotExists({
                        name: artist.name,
                        lookupGenius: true
                    })));

                    // First artist in artists array becomes primary artist
                    // as they are listed first most of the times (can be changed later
                    // by admins)
                    const primaryArtist: Artist = featuredArtists.splice(0, 1)[0];

                    // Create album found in id3tags if not exists.
                    const album: Album = await albumService.createIfNotExists({
                        name: id3Tags.album,
                        primaryArtist: primaryArtist,
                        lookupGenius: true
                    });
    
                    // Create artwork if a similar one does not already exist.
                    const cover: Artwork = await artworkService.findOrCreateArtwork({
                        fromSource: id3Tags.cover,
                        name: `${songTitle} ${primaryArtist.name}`,
                        mount: mount,
                        type: ArtworkType.SONG
                    })
    
                    // Create song if not exists.
                    const result: [Song, boolean] = await songService.createIfNotExists({
                        duration: id3Tags.duration,
                        name: songTitle,
                        file: file,
                        album: album,
                        order: id3Tags.orderNr,
                        primaryArtist: primaryArtist,
                        featuredArtists: featuredArtists,
                        cover: cover
                    });
    
                    const song = result[0];
                    const existed = result[1];
    
                    // If the mode is set to SCAN, it means the file will be 
                    // scanned from scratch and possibly overwrite data.
                    if(mode == IndexerProcessMode.SCAN) {
                        // Is there already a song existing with the scanned
                        // metadata? If so, mark file as duplicate
                        // Otherwise update the file's relation to 
                        // point to newly created song
                        if(existed) {
                            // logger.warn(`Found a duplicate song file '${filepath}'. Is a duplicate of: ${song.name} by ${song.primaryArtist.name} of album ${song.album.name}`);
                            reportError(new Error("Duplicate song file detected."), FileFlag.DUPLICATE, true);
                            return;
                        } else {
                            // Update the file's relation to the created song.
                            await fileService.setSong(file, song);
                        }
                    } else {
                        if(!existed) {
                            reportError(new Error("Rescanning a file that was never scanned before is not allowed."));
                            return;
                        } else {
                            // At this point, the scan-mode is set to RESCAN (meaning the file should be updated)
                            logger.warn(`Song for file '${filepath}' already existed. Updating song metadata...`);
                            await songService.setCover(song, cover);
                            await songService.setAlbumOrder(song, id3Tags.orderNr);
                            await fileService.setSong(file, song);
                        }
                    }
                    
                    // Clear circular structure
                    file.song = null;

                    // End worker by reporting success
                    reportSuccess(song);
                }).catch((error) => {
                    reportError(error);
                });
            })

            /**
             * Report success and return the result to the queue.
             * @param result Result to return to queue.
             */
            async function reportSuccess(result: Song) {
                job.finishedOn = Date.now();
                dc(null, result);
            }

            /**
             * Report error and return to queue.
             * @param error Error object to throw
             * @param fileFlag (Optional) Set a new flag for status reporting.
             */
            async function reportError(error: Error, fileFlag: FileFlag = FileFlag.FAILED_SONG_CREATION, skipRetry = false) {
                await fileService.setFlag(file, fileFlag);
                
                if(skipRetry) dc(null, null);
                else dc(error, null);
            }

        }).catch((error) => {
            reportError(error);
        });
    });
}

