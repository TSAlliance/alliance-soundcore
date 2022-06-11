import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Job, Queue } from 'bull';
import { Album } from '../../album/entities/album.entity';
import { Artist } from '../../artist/entities/artist.entity';
import { EVENT_METADATA_CREATED, QUEUE_GENIUS_NAME } from '../../constants';
import { IndexerResultDTO } from '../../indexer/dtos/indexer-result.dto';
import { Mount } from '../../mount/entities/mount.entity';
import { Song } from '../../song/entities/song.entity';
import { Resource } from '../../utils/entities/resource';
import { GeniusProcessDTO, GeniusProcessType } from '../dtos/genius-process.dto';
import { GeniusSongDTO } from '../lib/genius-song.dto';

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
    }

    @OnEvent(EVENT_ALBUM_CREATED)
    public handleAlbumCreatedEvent(payload: Album, useMount: Mount) {
        console.log("trigger genius lookup for album: ", payload.name);
        this.createAlbumLookupJob(payload, useMount);
    }*/

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




























    public async findAndApplySongInfo(song: Song): Promise<{ song: Song, dto?: GeniusSongDTO }> {
        // const title = song?.name?.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0];
        // const artists = song.artists[0]?.name || "";
        // let query: string;

        // if(!title) {
        //     console.warn("Found a song without title: ", song.index.name)
        //     return { song, dto: null };
        // }

        // if(artists != "") {
        //     query = title + " " + artists
        // } else {
        //     query = song.name
        // }

        // console.log("find song on genius for query: ", query)

        // return this.searchResourceIdOfType("song", query).then((resourceId) => {
        //     console.log("found id: ", resourceId)
        //     if(!resourceId) return { song };


        //     // Request more detailed song data
        //     return this.fetchResourceByIdAndType<GeniusSongDTO>("song", resourceId).then(async (songDto) => {
        //         console.log("found dto data? ", !!songDto)
        //         if(!songDto) return { song };

        //         // Create distributor if not exists
        //         const distributorResult = songDto.custom_performances.find((perf) => perf.label == "Distributor");
        //         if(distributorResult) {
        //             const distributor = await this.distributorService.createIfNotExists({ name: distributorResult.artists[0].name, geniusId: distributorResult.artists[0].id, externalImgUrl: distributorResult.artists[0].image_url })
        //             if(distributor) song.distributor = distributor;
        //         }

        //         // Create publisher if not exists
        //         const publisherResult = songDto.custom_performances.find((perf) => perf.label == "Publisher");
        //         if(publisherResult) {
        //             const publisher = await this.publisherService.createIfNotExists({ name: publisherResult.artists[0].name, geniusId: publisherResult.artists[0].id, externalImgUrl: publisherResult.artists[0].image_url })
        //             if(publisher) song.publisher = publisher;
        //         }

        //         // Create label if not exists
        //         const labelResult = songDto.custom_performances.find((perf) => perf.label == "Label");
        //         if(labelResult) {
        //             const label = await this.labelService.createIfNotExists({ name: labelResult.artists[0].name, geniusId: labelResult.artists[0].id, externalImgUrl: labelResult.artists[0].image_url })
        //             if(label) song.label = label;
        //         }

        //         // Create genres if not existing
        //         const genres = songDto.tags
        //         if(genres) {
        //             song.genres = [];

        //             for(const genreDto of genres) {
        //                 const result = await this.genreService.createIfNotExists({ name: genreDto.name, geniusId: genreDto.id })
        //                 song.genres.push(result);
        //             }
        //         }

        //         song.geniusId = songDto.id;
        //         // song.geniusUrl = songDto.url;
        //         // if(!song.banner) song.banner = await this.artworkService.create({ autoDownload: true, type: "banner_song", mountId: song.index.mount.id, url: songDto.header_image_url, dstFilename: song.index.name });
        //         song.location = songDto.recording_location;
        //         song.released = songDto.release_date;
        //         song.youtubeUrl = songDto.youtube_url;
        //         song.youtubeUrlStart = songDto.youtube_start;
        //         song.explicit = songDto.explicit;
        //         song.description = songDto.description_preview;

        //         // If there is no existing artwork on the song, then
        //         // take the url (if exists) from Genius.com and apply
        //         // as the new artwork
        //         // if(!song.artwork && songDto.song_art_image_thumbnail_url) {
        //         //     const artwork = await this.artworkService.create({ 
        //         //         type: "song",
        //         //         autoDownload: true,
        //         //         mountId: song.index.mount.id,
        //         //         url: songDto.song_art_image_thumbnail_url,
        //         //         dstFilename: song.index.name
        //         //     });
        //         //     // if(artwork) song.artwork = artwork
        //         // }

        //         return { song, dto: songDto };
        //     }).catch((error) => {
        //         this.logger.warn("Error occured when searching for song info on Genius.com: ");
        //         console.error(error)
        //         throw error;
        //     })
        // }).catch((error) => {
        //     this.logger.warn("Error occured when searching for song info on Genius.com: ");
        //     console.error(error)
        //     throw error;
        // })
        return null;
    }

    /**
     * Search for an album by its name and primary artist's name on genius.com. If found
     * all the information is set to the album object.
     * This will apply info about release data, description, header image, cover image, label,
     * distributor, publisher and the id on genius.com
     * @param album Album to be searched
     * @param firstArtistName Primary artist's name
     * @param mountForArtwork Mount for possible artworks that could be created during the process
     * @returns Album
     */
    // public async findAndApplyAlbumInfo(album: Album, artists: Artist[], mountForArtwork?: string): Promise<{ album: Album, artist: GeniusArtistDTO }> {
    //     if(!album?.name) return;

    //     const artistsWithGeniusIds: string[] = artists.filter((a) => !!a.geniusId).map((a) => a.geniusId);
    //     const artistsWithoutGeniusIdnames: string[] = artists.map((a) => a.name);

    //     // Search album on genius.com
    //     // This looks up around 80 albums and checks if the titles match together if the primaryArtist equals one of the provided artists.
    //     const albums: GeniusAlbumDTO[] = []

    //     // Get list of albums by a title
    //     for(let i = 0; i < 8; i++) {
    //         const res = (await this.searchPage(i, "album", album?.name?.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, "").split("-")[0]));
    //         albums.push(...res.result as GeniusAlbumDTO[])
    //         if(!res.hasNextPage) break;
    //     }

    //     // Filter albums that contain one of the artists as primary artist
    //     const filteredExactAlbums = albums.filter((a) => artistsWithGeniusIds.includes(a.artist.id) || artistsWithoutGeniusIdnames.includes(a.artist.name))
    //     let bestMatch: { score: number, hit: GeniusAlbumDTO } = { score: 0, hit: null};

    //     for(const result of filteredExactAlbums) {
    //         const score = Levenshtein.getEditDistance(result.name, album.name);

    //         if(score <= bestMatch.score || bestMatch.hit == null) {
    //             bestMatch = { score, hit: result};

    //             // Step of optimization:
    //             // Stop this loop if the best possible was found.
    //             // Thats the case for when the score reaches 0
    //             if(score <= 0) break;
    //         }
    //     }
        
    //     if(!bestMatch || !bestMatch.hit || !bestMatch.hit.id) {
    //         return { album, artist: null };
    //     }
        
    //     return await this.fetchResourceByIdAndType<GeniusAlbumDTO>("album", bestMatch.hit.id).then(async (albumDto) => {
    //         if(!albumDto) return { album, artist: null };

    //         // Create distributor if not exists
    //         const distributorResult = albumDto.performance_groups.find((perf) => perf.label == "Distributor");
    //         if(distributorResult) {
    //             const distributor = await this.distributorService.createIfNotExists({ name: distributorResult.artists[0].name, geniusId: distributorResult.artists[0].id, externalImgUrl: distributorResult.artists[0].image_url, artworkMountId: mountForArtwork })
    //             if(distributor) album.distributor = distributor;
    //         }

    //         // Create publisher if not exists
    //         const publisherResult = albumDto.performance_groups.find((perf) => perf.label == "Publisher");
    //         if(publisherResult) {
    //             const publisher = await this.publisherService.createIfNotExists({ name: publisherResult.artists[0].name, geniusId: publisherResult.artists[0].id, externalImgUrl: publisherResult.artists[0].image_url, artworkMountId: mountForArtwork })
    //             if(publisher) album.publisher = publisher;
    //         }

    //         // Create label if not exists
    //         const labelResult = albumDto.performance_groups.find((perf) => perf.label == "Label");
    //         if(labelResult) {
    //             const label = await this.labelService.createIfNotExists({ name: labelResult.artists[0].name, geniusId: labelResult.artists[0].id, externalImgUrl: labelResult.artists[0].image_url, artworkMountId: mountForArtwork })
    //             if(label) album.label = label;
    //         }

    //         // album.banner = await this.artworkService.create({ type: "banner_album", autoDownload: true, dstFilename: album.name, url: albumDto.header_image_url, mountId: mountForArtwork })
    //         // album.artwork = await this.artworkService.create({ type: "album", autoDownload: true, dstFilename: album.name, url: albumDto.cover_art_thumbnail_url, mountId: mountForArtwork })
    //         album.geniusId = albumDto.id;
    //         album.released = albumDto.release_date;
    //         album.description = albumDto.description_preview;

    //         return { album, artist: albumDto.artist };
    //     return null;
    //     }).catch((error) => {
    //         this.logger.warn("Error occured when searching for album info on Genius.com: ", error);
    //         console.error(error)
    //         return { album, artist: null };
    //     })
    // }
}
