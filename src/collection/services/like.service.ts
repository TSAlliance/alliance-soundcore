import { BadRequestException, Injectable } from '@nestjs/common';
import { Song } from '../../song/entities/song.entity';
import { User } from '../../user/entities/user.entity';
import { LikedSong } from '../entities/liked-song.entity';
import { LikeRepository } from '../repositories/like.repository';

@Injectable()
export class LikeService {

    constructor(
        private likeRepository: LikeRepository
    ) {}

    public async findByUserAndSong(userId: string, songId: string): Promise<LikedSong> {
        return this.likeRepository.findOne({ where: { user: { id: userId }, song: { id: songId }}}) as Promise<LikedSong>
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

    public async likeAlbum(albumId: string) {
        //
    }

    public async likePlaylist(playlistId: string) {
        //
    }

}
