import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { Song } from '../song/entities/song.entity';
import { SongService } from '../song/song.service';
import { User } from '../user/entities/user.entity';
import { CreatePlaylistDTO } from './dtos/create-playlist.dto';
import { UpdatePlaylistSongsDTO } from './dtos/update-songs.dto';
import { Playlist } from './entities/playlist.entity';
import { Song2Playlist } from './entities/song2playlist.entity';
import { PlaylistPrivacy } from './enums/playlist-privacy.enum';
import { PlaylistRepository } from './repositories/playlist.repository';
import { Song2PlaylistRepository } from './repositories/song2playlist.repository';

@Injectable()
export class PlaylistService {
    

    constructor(
        private songService: SongService,
        private playlistRepository: PlaylistRepository,
        private song2playlistRepository: Song2PlaylistRepository
    ) {}

    public async findPlaylistProfileById(playlistId: string, requester?: User): Promise<Playlist> {
        const result = await this.playlistRepository.createQueryBuilder("playlist")
                .where("playlist.id = :playlistId", { playlistId })

                // This is for relations
                .leftJoin("playlist.song2playlist", "song2playlist")
                .leftJoin("song2playlist.song", "song")

                .leftJoinAndSelect("playlist.artwork", "artwork")
                .leftJoinAndSelect("playlist.author", "author")

                // Counting the songs
                .addSelect('COUNT(song2playlist.id)', 'songsCount')

                // SUM up the duration of every song to get total duration of the playlist
                .addSelect('SUM(song.duration)', 'totalDuration')
                .getRawAndEntities()

        const playlist = result.entities[0];
        if(!playlist) throw new NotFoundException("Playlist not found.")
        playlist.totalDuration = parseInt(result.raw[0].totalDuration);
        playlist.songsCount = parseInt(result.raw[0].songsCount)

        if(!await this.hasUserAccessToPlaylist(playlist, requester)) {
            return null;
        }

        return playlist
    }

    public async findPlaylistByIdWithInfo(playlistId: string): Promise<Playlist> {
        return this.playlistRepository.findOne({ where: { id: playlistId }, relations: ["artwork", "author", "collaborators"]})
    }

    public async findPlaylistByIdWithRelations(playlistId: string): Promise<Playlist> {
        return this.playlistRepository.findOne({ where: { id: playlistId }, relations: ["artwork", "author", "collaborators", "song2playlist"]})
    }

    public async findAllOrPageByAuthor(authorId: string, pageable?: Pageable, requester?: User): Promise<Page<Playlist>> {
        if(authorId == requester?.id) {
            // Return all playlists if its the author requesting his playlists
            const result = await this.playlistRepository.find({ where: { author: { id: authorId }}, relations: ["artwork", "author", "collaborators"]});
            return Page.of(result, result.length, 0)
        }

        // TODO: Check if requester is allowed to see every playlist of a user
        // if(requester && requester.hasPermission("playlists.read")) {
        //     return this.playlistRepository.findAll(pageable, { where: { author: { id: authorId }}})
        // } else {
            
        // }

        // TODO: Add liked playlists and the collab playlists as well

        return this.playlistRepository.findAll(pageable, { where: { privacy: PlaylistPrivacy.PUBLIC, author: { id: authorId }}, relations: ["artwork", "author", "collaborators"]})
    }

    public async findSongsInPlaylist(playlistId: string, pageable: Pageable, requester: User): Promise<Page<Song>> {
        const playlist = await this.playlistRepository.findOne({ where: { id: playlistId }});
        if(!playlist) throw new NotFoundException("Playlist not found.")

        if(!await this.hasUserAccessToPlaylist(playlist, requester)) {
            throw new NotFoundException("No access")
        }

        return this.songService.findByPlaylist(playlistId, pageable);
    }

    public async existsByTitleInUser(title: string, userId: string): Promise<boolean> {
        return !! (await this.playlistRepository.findOne({ where: { title, author: { id: userId }}}))
    }

    public async create(createPlaylistDto: CreatePlaylistDTO, author: User): Promise<Playlist> {
        if(await this.existsByTitleInUser(createPlaylistDto.title, author.id)) throw new BadRequestException("Playlist already exists.");
        return this.playlistRepository.save({
            ...createPlaylistDto,
            author
        })
    }

    /**
     * Add a song to a playlist
     * @param playlistId Playlist's id
     * @param songId Song's id
     * @param requester The user requesting the operation. Used to check if the user is allowed to add songs
     * @returns 
     */
    public async updateSongs(playlistId: string, updateSongsDto: UpdatePlaylistSongsDTO, requester: User): Promise<Playlist> {
        const playlist: Playlist = await this.findPlaylistByIdWithRelations(playlistId);
        if(!playlist) throw new NotFoundException("Playlist does not exist.");

        if(!await this.hasUserAccessToPlaylist(playlist, requester)) {
            throw new NotFoundException("Playlist not found.")
        }

        if(!playlist.song2playlist) playlist.song2playlist = [];

        if(updateSongsDto.action == "add") {
            // Add songs
            for(const obj of updateSongsDto.songs) {
                // Check if the songs exist in databse to prevent
                // errors.
                const song = await this.songService.findById(obj.id);
                if(!song) continue;

                const relation = new Song2Playlist()
                relation.song = song;
                relation.playlist = playlist;

                await this.song2playlistRepository.save(relation)
            }

            return playlist;
        } else if(updateSongsDto.action == "remove") {
            // Remove songs
            const songs = updateSongsDto.songs.map((song) => song.id);
            playlist.song2playlist = playlist.song2playlist.filter((song2playlist) => !songs.includes(song2playlist.songId));

            return this.playlistRepository.save(playlist)
        }
    }

    private async hasUserAccessToPlaylist(playlist: Playlist, user: User): Promise<boolean> {
        if(!playlist || !user) return false;
        if(playlist.author?.id == user?.id) return true

        if(playlist.collaborative) {
            // If playlist is open to collaborators,
            // but user is not in collaborators list or the playlist is set to private, then deny the request.
            if(playlist.privacy == PlaylistPrivacy.PRIVATE || !playlist.collaborators.find((user) => user.id == user?.id)) return false;
        }

        return true;
    }

}