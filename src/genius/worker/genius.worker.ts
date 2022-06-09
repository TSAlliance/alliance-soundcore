import { EventEmitter2 } from "@nestjs/event-emitter";
import { DoneCallback, Job } from "bull";
import { AlbumService } from "../../album/album.service";
import { Album } from "../../album/entities/album.entity";
import { AlbumRepository } from "../../album/repositories/album.repository";
import { ArtistService } from "../../artist/artist.service";
import { Artist } from "../../artist/entities/artist.entity";
import { ArtistRepository } from "../../artist/repositories/artist.repository";
import { ArtworkStorageHelper } from "../../artwork/helper/artwork-storage.helper";
import { ArtworkRepository } from "../../artwork/repositories/artwork.repository";
import { ArtworkService } from "../../artwork/services/artwork.service";
import { TYPEORM_CONNECTION_GENERAL } from "../../constants";
import { DistributorRepository } from "../../distributor/repositories/distributor.repository";
import { DistributorService } from "../../distributor/services/distributor.service";
import { LabelRepository } from "../../label/repositories/label.repository";
import { LabelService } from "../../label/services/label.service";
import { Song } from "../../song/entities/song.entity";
import { SongRepository } from "../../song/repositories/song.repository";
import { SongService } from "../../song/song.service";
import { GeniusFlag, Resource } from "../../utils/entities/resource";
import { DBWorker } from "../../utils/workers/worker.util";
import { GeniusProcessDTO, GeniusProcessType } from "../dtos/genius-process.dto";
import { GeniusClientService } from "../services/genius-client.service";

export default function (job: Job<GeniusProcessDTO>, dc: DoneCallback) {

    DBWorker.instance().then((worker) => {
        worker.establishConnection(TYPEORM_CONNECTION_GENERAL).then(async (connection) => {
            const eventEmitter = new EventEmitter2();

            // Build services
            const artistService = new ArtistService(connection.getCustomRepository(ArtistRepository), eventEmitter);
            const albumService = new AlbumService(connection.getCustomRepository(AlbumRepository), eventEmitter);
            const songService = new SongService(connection.getCustomRepository(SongRepository));

            // Build GeniusClientService and dependencies
            const artworkService = new ArtworkService(connection.getCustomRepository(ArtworkRepository), new ArtworkStorageHelper());
            const labelService = new LabelService(connection.getCustomRepository(LabelRepository));
            const distributorService = new DistributorService(connection.getCustomRepository(DistributorRepository));
            const clientService = new GeniusClientService(artworkService, labelService, distributorService);

            // Handle different types of
            // genius lookup processes
            switch (job.data.type) {
                case GeniusProcessType.ARTIST:
                    await lookupArtist(job, artistService, clientService, dc);
                    break;
                case GeniusProcessType.ALBUM:
                    await lookupAlbum(job, albumService, clientService, dc);
                    break;    
                case GeniusProcessType.SONG:
                    await lookupSong(job, songService, clientService, dc);
                    break;    
            
                default:
                    reportError(new Error("Unknown genius process type found."), dc);
                    break;
            }
        
        }).catch((error) => {
            reportError(error, dc);
        })
    })
}

/**
 * Lookup artist on genius
 * @param job Job information
 * @param service ArtistService
 * @param geniusService Genius ClientService
 * @param dc DoneCallback
 */
async function lookupArtist(job: Job<GeniusProcessDTO>, service: ArtistService, geniusService: GeniusClientService, dc: DoneCallback) {
    const artistData = job.data.payload as Artist;
    // Update genius flag
    await service.setGeniusFlag(artistData, GeniusFlag.GENIUS_PENDING);

    // Lookup artist data
    geniusService.lookupArtist(artistData, job.data.useMount).then((artist) => {
        // Update genius flag
        artist.geniusFlag = GeniusFlag.OK;
        return service.save(artist).then(async (result) => {
            reportSuccess(result, dc);
        });
    }).catch(async (error) => {
        await service.setGeniusFlag(artistData, GeniusFlag.GENIUS_FAILED);
        reportError(error, dc);
    });
}

/**
 * Lookup album on genius
 * @param job Job information
 * @param service AlbumService
 * @param geniusService Genius ClientService
 * @param dc DoneCallback
 */
 async function lookupAlbum(job: Job<GeniusProcessDTO>, service: AlbumService, geniusService: GeniusClientService, dc: DoneCallback) {
    const albumData = job.data.payload as Album;
    // Update genius flag
    await service.setGeniusFlag(albumData, GeniusFlag.GENIUS_PENDING);

    // Lookup album data
    geniusService.lookupAlbum(albumData, job.data.useMount).then((album) => {
        // Update genius flag
        album.geniusFlag = GeniusFlag.OK;
        return service.save(album).then(async (result) => {
            reportSuccess(result, dc);
        });
    }).catch(async (error) => {
        await service.setGeniusFlag(albumData, GeniusFlag.GENIUS_FAILED);
        reportError(error, dc);
    });
}

/**
 * Lookup song on genius
 * @param job Job information
 * @param service SongService
 * @param geniusService Genius ClientService
 * @param dc DoneCallback
 */
 async function lookupSong(job: Job<GeniusProcessDTO>, service: SongService, geniusService: GeniusClientService, dc: DoneCallback) {
    const songData = job.data.payload as Song;
    // Update genius flag
    await service.setGeniusFlag(songData, GeniusFlag.GENIUS_PENDING);

    // Lookup song data
    geniusService.lookupSong(songData, job.data.useMount).then((song) => {
        // Update genius flag
        song.geniusFlag = GeniusFlag.OK;
        return service.save(song).then(async (result) => {
            reportSuccess(result, dc);
        });
    }).catch(async (error) => {
        await service.setGeniusFlag(songData, GeniusFlag.GENIUS_FAILED);
        reportError(error, dc);
    });
}

function reportSuccess(result: Resource, dc: DoneCallback) {
    dc(null, result);
}

function reportError(error: Error, dc: DoneCallback) {
    dc(error, null);
}