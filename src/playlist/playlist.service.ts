import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { DeleteResult, In, Not } from 'typeorm';
import { IndexStatus } from '../index/enum/index-status.enum';
import { SongService } from '../song/song.service';
import { User } from '../user/entities/user.entity';
import { CreatePlaylistDTO } from './dtos/create-playlist.dto';
import { UpdatePlaylistDTO } from './dtos/update-playlist.dto';
import { PlaylistItem } from './entities/playlist-item.entity';
import { Playlist } from './entities/playlist.entity';
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

    public async findById(playlistId: string): Promise<Playlist> {
        const result = await this.playlistRepository.createQueryBuilder("playlist")
            .leftJoinAndSelect("playlist.author", "author")
            .where("playlist.id = :playlistId", { playlistId })
            .orWhere("playlist.slug = :playlistId", { playlistId })
            .getOne();

        return result;
    }

    /**
     * Finds a profile of a playlist including songs count and totalDuration.
     * @param playlistId Id of the playlist
     * @param requester User that requests information. Used to check if the user is allowed to access the playlist.
     * @returns Playlist
     */
    public async findPlaylistProfileById(playlistId: string, authentication: User): Promise<Playlist> {
        if(!await this.hasUserAccessToPlaylist(playlistId, authentication)) {
            console.log("user has no access")
            return null;
        }

        const result = await this.playlistRepository.createQueryBuilder("playlist")

                // This is for relations
                .leftJoin("playlist.items", "item")
                .leftJoin("item.song", "song")
                .leftJoin("song.index", "index", "index.status = :status", { status: IndexStatus.OK })

                .leftJoinAndSelect("playlist.artwork", "artwork")
                .leftJoinAndSelect("playlist.author", "author")

                // Count how many likes. This takes user's id in count
                .loadRelationCountAndMap("playlist.liked", "playlist.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))

                // Counting the songs
                .addSelect('COUNT(index.id)', 'songsCount')
                
                // SUM up the duration of every song to get total duration of the playlist
                .addSelect('SUM(song.duration)', 'totalDuration')

                .groupBy("playlist.id")
                .where("playlist.id = :playlistId OR playlist.slug = :playlistId", { status: IndexStatus.OK, playlistId })
                .getRawAndEntities()

        const playlist = result.entities[0];
        if(!playlist) throw new NotFoundException("Playlist not found.")
        playlist.totalDuration = parseInt(result.raw[0].totalDuration);
        playlist.songsCount = parseInt(result.raw[0].songsCount)

        return playlist
    }

    public async findPlaylistByIdWithInfo(playlistId: string): Promise<Playlist> {
        return this.playlistRepository.findOne({ where: { id: playlistId }, relations: ["artwork", "author", "collaborators"]})
    }

    public async findPlaylistByIdWithSongs(playlistId: string): Promise<Playlist> {
        return this.playlistRepository.findOne({ where: { id: playlistId }, relations: ["items", "items.song", "author", "artwork"]})
    }

    public async findPlaylistByIdWithCollaborators(playlistId: string): Promise<Playlist> {
        return this.playlistRepository.findOne({ where: { id: playlistId }, relations: ["collaborators", "author"]})
    }

    public async findPlaylistByIdWithRelations(playlistId: string): Promise<Playlist> {
        return this.playlistRepository.findOne({ where: { id: playlistId }, relations: ["artwork", "author", "collaborators", "items", "items.song"]})
    }

    /**
     * Find all playlists that belong to an authenticated user.
     * This includes all authored playlists as well as liked and
     * collaborative playlists of others.
     * @param authentication KeycloakUser instance
     * @returns Page<Playlist>
     */
    public async findAllByAuthenticatedUser(authentication: User): Promise<Page<Playlist>> {
        const result = await this.buildDefaultQuery("playlist")
            .leftJoin("playlist.author", "author")
            .leftJoin("playlist.artwork", "artwork")
            .leftJoin("playlist.collaborators", "collaborator")
            .leftJoin("playlist.likedBy", "likedBy")
            .leftJoin("likedBy.user", "likedByUser")

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("playlist.liked", "playlist.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication.id }))

            .addSelect(["author.id", "author.name", "author.slug", "artwork.id", "artwork.accentColor"])
            .where("author.id = :authorId", { authorId: authentication.id })
            .orWhere("collaborator.id = :userId", { userId: authentication.id })
            .orWhere("likedByUser.id = :userId", { userId: authentication.id })
            .andWhere("playlist.privacy != :privacy", { privacy: PlaylistPrivacy.PRIVATE })
            .getManyAndCount();

        return Page.of(result[0], result[1], 0);
    }

    /**
     * Find public playlists by an author.
     * @param authorId Author to lookup playlists for
     * @param pageable Page settings
     * @param authentication User authentication object to check playlist access
     * @returns Page<Playlist>
     */
    public async findByAuthor(authorId: string, pageable: Pageable, authentication: User): Promise<Page<Playlist>> {
        if(authorId == "@me" || authorId == authentication.id || authorId == authentication.slug) authorId = authentication.id;
        
        // TODO: Test on user profiles
        const result = await this.playlistRepository.createQueryBuilder("playlist")
            .leftJoin("playlist.author", "author")
            .leftJoin("playlist.artwork", "artwork")
            .leftJoin("playlist.collaborators", "collaborator")

            // Pagination
            .limit(pageable?.size || 30)
            .offset((pageable?.size || 30) * (pageable?.page || 0))

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("playlist.liked", "playlist.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication.id }))

            .addSelect(["author.id", "author.name", "author.slug", "artwork.id", "artwork.accentColor"])
            .where("author.id = :authorId OR author.slug = :authorId", { authorId: authorId })
            .orWhere("collaborator.id = :userId", { userId: authentication.id })
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findByArtist(artistId: string, pageable: Pageable, authentication: User): Promise<Page<Playlist>> {
        const result = await this.playlistRepository.createQueryBuilder("playlist")
            .leftJoin("playlist.items", "item")
            .leftJoin("item.song", "song")
            .leftJoin("song.artists", "artist")

            .leftJoinAndSelect("playlist.author", "author")
            .leftJoinAndSelect("playlist.artwork", "artwork")
            .leftJoin("playlist.collaborators", "collaborator")
            .leftJoin("playlist.likedBy", "likedByUser", "likedByUser.userId = :userId", { userId: authentication.id })

            // Pagination
            .limit(pageable?.size || 30)
            .offset((pageable?.size || 30) * (pageable?.page || 0))

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("playlist.liked", "playlist.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication.id }))

            .where("(artist.id = :artistId OR artist.slug = :artistId) AND (playlist.privacy = :privacy OR author.id = :authorId OR collaborator.id = :authorId OR (likedByUser.userId = :authorId AND playlist.privacy != 'private'))", { artistId: artistId, privacy: PlaylistPrivacy.PUBLIC.toString(), authorId: authentication.id })
            .getManyAndCount();

        return Page.of(result[0], result[1], pageable.page);
    }

    public async findByGenre(genreId: string, pageable: Pageable, authentication: User): Promise<Page<Playlist>> {
        const result = await this.playlistRepository.createQueryBuilder("playlist")
            .leftJoin("playlist.author", "author")
            .leftJoin("playlist.artwork", "artwork")
            .leftJoin("playlist.items", "item")
            .leftJoin("item.song", "song")
            .leftJoin("song.genres", "genre")

            .addSelect(["artwork.id", "artwork.accentColor", "author.id", "author.name", "author.slug"])

            .offset(pageable.page * pageable.size)
            .limit(pageable.size)

            .where("genre.id = :genreId OR genre.slug = :genreId", { genreId })
            .getMany()

            // TODO: Check if user has access to playlist

        return Page.of(result, result.length, pageable.page);
    }

    public async existsByTitleInUser(title: string, userId: string, playlistId?: string): Promise<boolean> {
        if(playlistId) return !! (await this.playlistRepository.findOne({ where: { name: title, author: { id: userId }, id: Not(playlistId)}}))
        return !! (await this.playlistRepository.findOne({ where: { name: title, author: { id: userId }}}))
    }

    /**
     * Create new playlist. This fails with 
     * @param createPlaylistDto Playlist metadata
     * @param author Author entity (User)
     * @throws BadRequestException if a playlist by its title already exists in user scope.
     * @returns 
     */
    public async create(createPlaylistDto: CreatePlaylistDTO, authentication: User): Promise<Playlist> {
        if(await this.existsByTitleInUser(createPlaylistDto.title, authentication.id)) throw new BadRequestException("Playlist already exists.");
        const playlist = new Playlist();
        playlist.author = authentication;
        playlist.name = createPlaylistDto.title;
        playlist.privacy = createPlaylistDto.privacy;

        return this.playlistRepository.save(playlist)
    }

    public async update(playlistId: string, updatePlaylistDto: UpdatePlaylistDTO, authentication: User): Promise<Playlist> {
        const playlist = await this.findById(playlistId);

        if(!playlist) throw new NotFoundException("Playlist not found.")
        if(!await this.hasUserAccessToPlaylist(playlistId, authentication) || !await this.canEditPlaylist(playlist, authentication)) throw new ForbiddenException("Not allowed to edit this playlist.")
        if(await this.existsByTitleInUser(updatePlaylistDto.title, authentication.id, playlistId)) throw new BadRequestException("Playlist already exists.");
        
        playlist.name = updatePlaylistDto.title || playlist.name;
        playlist.privacy = updatePlaylistDto.privacy || playlist.privacy;

        return this.playlistRepository.save(playlist)
    }

    /**
     * Add a song to a playlist
     * @param playlistId Playlist's id
     * @param songId Song's id
     * @param requester The user requesting the operation. Used to check if the user is allowed to add songs
     * @returns 
     */
    public async addSongs(playlistId: string, songIds: string[], authentication: User): Promise<Playlist> {
        // Check if user could theoretically access the playlist.
        if(!await this.hasUserAccessToPlaylist(playlistId, authentication)) {
            throw new NotFoundException("Playlist not found.")
        }

        const playlist: Playlist = await this.findPlaylistByIdWithSongs(playlistId);
        if(!playlist) throw new NotFoundException("Playlist does not exist.");    
        if(!playlist.items) playlist.items = [];

        // Check if user can edit the playlist
        if(!await this.canEditSongs(playlist, authentication)) {
            throw new ForbiddenException("Not allowed to add songs to that playlist.")
        }

        let hadDuplicates = false;
        for(const key of songIds) {
            // TODO: Optimize, as this would perform bad on large playlists (Remember this solution would be O(n2))
            if(!!playlist.items.find((v) => v.songId == key)) {
                // A song would be duplicate
                hadDuplicates = true;
                continue;
            }

            // Check if the songs exist in databse to prevent
            // errors.
            const song = await this.songService.findByIdWithArtwork(key);
            if(!song) continue;

            const relation = new PlaylistItem()
            relation.song = song;
            relation.playlist = playlist;

            await this.song2playlistRepository.save(relation).then(async () => {
                // TODO: Generate artwork
            })
        }

        if(hadDuplicates) {
            throw new ConflictException("Some songs were not added as they already exists in playlist.")
        }

        // Return updated playlist
        delete playlist.items;
        return playlist;
    }

    /**
     * Add a song to a playlist
     * @param playlistId Playlist's id
     * @param songId Song's id
     * @param requester The user requesting the operation. Used to check if the user is allowed to add songs
     * @returns 
     */
    public async removeSongs(playlistId: string, songIds: string[], authentication: User): Promise<Playlist> {
        if(!await this.hasUserAccessToPlaylist(playlistId, authentication)) {
            throw new NotFoundException("Playlist not found.")
        }

        const playlist: Playlist = await this.findPlaylistByIdWithSongs(playlistId);
        if(!playlist) throw new NotFoundException("Playlist does not exist.");

        // Check if user can edit the playlist
        if(!await this.canEditSongs(playlist, authentication)) {
            throw new ForbiddenException("Not allowed to remove songs from that playlist.")
        }

        if(!playlist.items) playlist.items = [];
        return this.song2playlistRepository.delete({ songId: In(songIds), playlistId }).then(() => {
            return playlist;
        }).catch(() => {
            return playlist;
        });
    }

    /**
     * Add a song to a playlist
     * @param playlistId Playlist's id
     * @param songId Song's id
     * @param requester The user requesting the operation. Used to check if the user is allowed to add songs
     * @returns 
     */
    public async addCollaborators(playlistId: string, collaboratorIds: string[], authentication: User): Promise<void> {
        if(!await this.hasUserAccessToPlaylist(playlistId, authentication)) {
            throw new NotFoundException("Playlist not found.")
        }

        const playlist: Playlist = await this.findPlaylistByIdWithSongs(playlistId);
        if(!playlist) throw new NotFoundException("Playlist does not exist.");

        // Check if user can edit the playlist
        if(!await this.canEditPlaylist(playlist, authentication)) {
            throw new ForbiddenException("Not allowed to edit that playlist.")
        }

        if(!playlist.collaborators) playlist.collaborators = [];
        playlist.collaborators.push(...collaboratorIds.map((id) => ({ id } as User)))
        playlist.collaborative = playlist.collaborators?.length > 0;
        return this.playlistRepository.save(playlist).then(() => {
            return;
        }).catch(() => {
            return;
        });
    }

    /**
     * Add a song to a playlist
     * @param playlistId Playlist's id
     * @param songId Song's id
     * @param requester The user requesting the operation. Used to check if the user is allowed to add songs
     * @returns 
     */
     public async removeCollaborators(playlistId: string, collaboratorIds: string[], authentication: User): Promise<void> {
        if(!await this.hasUserAccessToPlaylist(playlistId, authentication)) {
            throw new NotFoundException("Playlist not found.")
        }

        const playlist: Playlist = await this.findPlaylistByIdWithSongs(playlistId);
        if(!playlist) throw new NotFoundException("Playlist does not exist.");

        // Check if user can edit the playlist
        if(!await this.canEditPlaylist(playlist, authentication)) {
            throw new ForbiddenException("Not allowed to edit that playlist.")
        }

        if(!playlist.collaborators) playlist.collaborators = [];
        playlist.collaborators = playlist.collaborators.filter((u) => collaboratorIds.includes(u.id));
        playlist.collaborative = playlist.collaborators?.length > 0;

        return this.playlistRepository.save(playlist).then(() => {
            return;
        }).catch(() => {
            return;
        });
    }

    public async deleteById(playlistId: string, authentication?: User): Promise<DeleteResult> {
        const playlist = await this.findById(playlistId);

        if(playlist.author?.id != authentication?.id) throw new ForbiddenException("Not allowed.");
        return this.playlistRepository.delete({ id: playlist?.id });
    }

    private async hasUserAccessToPlaylist(playlistId: string, authentication: User): Promise<boolean> {
        const result = await this.playlistRepository.createQueryBuilder("playlist")
            .leftJoin("playlist.author", "author")
            .leftJoin("playlist.collaborators", "collaborator")

            .select(["playlist.id", "playlist.privacy", "author.id", "collaborator.id"])
            .where("playlist.id = :playlistId", { playlistId })
            .orWhere("playlist.slug = :playlistId", { playlistId })

            .getOne()

        if(!result) return false;
        if(result.privacy != PlaylistPrivacy.PRIVATE) return true;
        if(result.author?.id == authentication.id) return true;
        if(result.collaborators.find((u) => u.id == authentication.id)) return true;
        return false;
    }

    private async canEditPlaylist(playlist: Playlist, authentication: User): Promise<boolean> {
        return playlist?.author?.id == authentication?.id;
    }

    private async canEditSongs(playlist: Playlist, authentication: User): Promise<boolean> {
        return playlist?.author?.id == authentication?.id || !!playlist?.collaborators?.find((u) => u?.id == authentication?.id);
    }

    private buildDefaultQuery(alias: string, authentication?: User) {
        return this.playlistRepository.createQueryBuilder(alias)
            .loadRelationCountAndMap("playlist.liked", "playlist.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication?.id }))
    }

    /**
     * Execute search query for a song. This looks up songs that match the query.
     * The search includes looking for songs with a specific artist's name.
     * @param query Query string
     * @param pageable Page settings
     * @returns Page<Song>
     */
     public async findBySearchQuery(query: string, pageable: Pageable, authentication?: User): Promise<Page<Playlist>> {
        if(!query || query == "") {
            query = "%"
        } else {
            query = `%${query.replace(/\s/g, '%')}%`;
        }

        // Find song by title or if the artist has similar name
        let qb = await this.playlistRepository.createQueryBuilder("playlist")
            .leftJoin("playlist.author", "author")
            .leftJoin("playlist.artwork", "artwork")
            .leftJoin("playlist.collaborators", "collaborator")

            // Pagination
            .limit(pageable?.size || 10)
            .offset((pageable?.size || 10) * (pageable?.page || 0))

            // Count how many likes. This takes user's id in count
            .loadRelationCountAndMap("playlist.liked", "playlist.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: authentication.id }))

            .addSelect(["author.id", "author.name", "author.slug", "artwork.id", "artwork.accentColor"])
            .where("playlist.title LIKE :query AND (author.id = :userId OR collaborator.id = :userId OR playlist.privacy = :privacy)", { query, privacy: PlaylistPrivacy.PUBLIC, userId: authentication.id })

        if(query == "%") {
            qb = qb.orderBy("rand()");
        }

        const result = await qb.getManyAndCount();
        return Page.of(result[0], result[1], pageable.page);
    }

}