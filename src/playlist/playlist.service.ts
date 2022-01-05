import { BadRequestException, Injectable } from '@nestjs/common';
import { SSOUser } from '@tsalliance/sso-nest';
import { CreatePlaylistDTO } from './dtos/create-playlist.dto';
import { Playlist } from './entities/playlist.entity';
import { PlaylistRepository } from './repositories/playlist.repository';

@Injectable()
export class PlaylistService {

    constructor(private playlistRepository: PlaylistRepository) {}

    public async existsByTitleInUser(title: string, userId: string): Promise<boolean> {
        return !! (await this.playlistRepository.findOne({ where: { title, author: { id: userId }}}))
    }

    public async create(createPlaylistDto: CreatePlaylistDTO, author: SSOUser): Promise<Playlist> {
        if(await this.existsByTitleInUser(createPlaylistDto.title, author.id)) throw new BadRequestException("Playlist already exists.");
        return this.playlistRepository.save(createPlaylistDto)
    }

}
