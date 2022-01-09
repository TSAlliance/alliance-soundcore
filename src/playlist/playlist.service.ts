import { BadRequestException, Injectable } from '@nestjs/common';
import { SSOUser } from '@tsalliance/sso-nest';
import { Page, Pageable } from 'nestjs-pager';
import { CreatePlaylistDTO } from './dtos/create-playlist.dto';
import { Playlist } from './entities/playlist.entity';
import { PlaylistPrivacy } from './enums/playlist-privacy.enum';
import { PlaylistRepository } from './repositories/playlist.repository';

@Injectable()
export class PlaylistService {

    constructor(private playlistRepository: PlaylistRepository) {}

    public async findPageByAuthor(authorId: string, pageable?: Pageable, requester?: SSOUser): Promise<Page<Playlist>> {
        if(authorId == requester?.id) return this.playlistRepository.findAll(pageable, { where: { author: { id: authorId }}, relations: ["artwork", "author", "collaborators"]})

        // TODO: Check if requester is allowed to see every playlist of a user
        // if(requester && requester.hasPermission("playlists.read")) {
        //     return this.playlistRepository.findAll(pageable, { where: { author: { id: authorId }}})
        // } else {
            
        // }

        return this.playlistRepository.findAll(pageable, { where: { privacy: PlaylistPrivacy.PUBLIC, author: { id: authorId }}, relations: ["artwork", "author", "collaborators"]})
    }

    public async existsByTitleInUser(title: string, userId: string): Promise<boolean> {
        return !! (await this.playlistRepository.findOne({ where: { title, author: { id: userId }}}))
    }

    public async create(createPlaylistDto: CreatePlaylistDTO, author: SSOUser): Promise<Playlist> {
        if(await this.existsByTitleInUser(createPlaylistDto.title, author.id)) throw new BadRequestException("Playlist already exists.");
        return this.playlistRepository.save({
            ...createPlaylistDto,
            author
        })
    }

}
