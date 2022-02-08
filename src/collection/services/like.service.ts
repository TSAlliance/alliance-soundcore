import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Playlist } from '../../playlist/entities/playlist.entity';
import { PlaylistPrivacy } from '../../playlist/enums/playlist-privacy.enum';
import { PlaylistService } from '../../playlist/playlist.service';
import { Song } from '../../song/entities/song.entity';
import { User } from '../../user/entities/user.entity';
import { LikedPlaylist } from '../entities/liked-playlist.entity';
import { LikedSong } from '../entities/liked-song.entity';
import { LikeRepository } from '../repositories/like.repository';

@Injectable()
export class LikeService {

    constructor(
        private playlistService: PlaylistService,
        private likeRepository: LikeRepository
    ) {}

    public async findByUserAndSong(userId: string, songId: string): Promise<LikedSong> {
        return this.likeRepository.findOne({ where: { user: { id: userId }, song: { id: songId }}}) as Promise<LikedSong>
    }

    public async findByUserAndPlaylist(userId: string, playlistId: string): Promise<LikedPlaylist> {
        return this.likeRepository.findOne({ where: { user: { id: userId }, playlist: { id: playlistId }}}) as Promise<LikedPlaylist>
    }
    public async isPlaylistAuthor(userId: string, playlistId: string): Promise<boolean> {
        return !! await this.likeRepository.findOne({ where: { playlist: { id: playlistId, author: { id: userId }}}})
    }

    public async likeSong(songId: string, user: User): Promise<void> {
        const existing = await this.findByUserAndSong(user.id, songId);

        // Remove like if exists.
        if(existing) {
            await this.likeRepository.delete({ id: existing.id }).catch(() => {
                throw new BadRequestException("Could not remove like from song.")
            })
            return;
        }

        const like = new LikedSong()
        like.user = user;
        like.song = { id: songId } as Song;

        await this.likeRepository.save(like).catch(() => {
            throw new BadRequestException("Could not like song.")
        })
    }

    public async likePlaylist(playlistId: string, user: User): Promise<void> {
        const playlist = await this.playlistService.findById(playlistId);
        if(!playlist) throw new NotFoundException();
        if(playlist.author?.id == user?.id) throw new BadRequestException("Author cannot like his own playlists.");
        if(playlist.privacy == PlaylistPrivacy.PRIVATE) throw new BadRequestException("Cannot like this type of playlist.")

        const existing = await this.findByUserAndPlaylist(user.id, playlistId);
        // Remove like if exists.
        if(existing) {
            await this.likeRepository.delete({ id: existing.id }).catch(() => {
                throw new BadRequestException("Could not remove like from playlist.")
            })
            return;
        }

        const like = new LikedPlaylist()
        like.user = user;
        like.playlist = { id: playlistId } as Playlist;

        await this.likeRepository.save(like).catch(() => {
            throw new BadRequestException("Could not like playlist.")
        })
    }

    public async likeAlbum(albumId: string) {
        //
    }

}