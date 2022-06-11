import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Job, Queue } from 'bull';
import { Album } from '../../album/entities/album.entity';
import { Artist } from '../../artist/entities/artist.entity';
import { EVENT_ALBUM_CREATED, EVENT_METADATA_CREATED, QUEUE_GENIUS_NAME } from '../../constants';
import { AlbumCreatedEvent } from '../../events/albumCreated.event';
import { IndexerResultDTO } from '../../indexer/dtos/indexer-result.dto';
import { Mount } from '../../mount/entities/mount.entity';
import { Song } from '../../song/entities/song.entity';
import { Resource } from '../../utils/entities/resource';
import { GeniusProcessDTO, GeniusProcessType } from '../dtos/genius-process.dto';

@Injectable()
export class GeniusService {
    private readonly logger: Logger = new Logger(GeniusService.name);

    constructor(
        @InjectQueue(QUEUE_GENIUS_NAME) private readonly queue: Queue<GeniusProcessDTO>
    ) {
        this.queue?.on("failed", (job, err) => {
            this.logger.error(`${err.message}`, err.stack);
        })
        this.queue?.on("completed", (job: Job<GeniusProcessDTO>, result: Resource) => {
            const type = result.resourceType;
            this.logger.verbose(`Successfully looked up ${type} '${result.name}' on genius.`);
        })
    }
    
    @OnEvent(EVENT_METADATA_CREATED)
    public handleMetadataCreatedEvent(payload: IndexerResultDTO) {
        if(payload?.createdSong) this.createSongLookupJob(payload.createdSong, payload.mount);
        if(payload?.createdAlbum) this.createAlbumLookupJob(payload.createdAlbum, payload.mount);
        if(payload?.createdArtists && payload.createdArtists.length > 0) {
            for(const artist of payload.createdArtists) {
                this.createArtistLookupJob(artist, payload.mount);
            }
        }
    }

    /*@OnEvent(EVENT_ARTIST_CREATED)
    public handleArtistCreatedEvent(payload: Artist, useMount: Mount) {
        console.log("trigger genius lookup for artist: ", payload.name);
        this.createArtistLookupJob(payload, useMount);
    }*/

    @OnEvent(EVENT_ALBUM_CREATED)
    public handleAlbumCreatedEvent(payload: AlbumCreatedEvent) {
        this.createAlbumLookupJob(payload.target, payload.mount);
    }

    public async createSongLookupJob(song: Song, useMount: Mount) {
        const dto = new GeniusProcessDTO<Song>(GeniusProcessType.SONG, song, useMount);
        return this.queue.add(dto);
    } 

    public async createAlbumLookupJob(album: Album, useMount: Mount) {
        const dto = new GeniusProcessDTO<Album>(GeniusProcessType.ALBUM, album, useMount);
        return this.queue.add(dto);
    } 

    public async createArtistLookupJob(artist: Artist, useMount: Mount) {
        const dto = new GeniusProcessDTO<Artist>(GeniusProcessType.ARTIST, artist, useMount);
        return this.queue.add(dto);
    } 
}
