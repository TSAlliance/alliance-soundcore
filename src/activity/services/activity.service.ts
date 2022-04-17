import { Injectable } from '@nestjs/common';
import { User } from '../../user/entities/user.entity';
import { CreateActivityDTO } from '../dtos/create-activity.dto';
import { Activity } from '../entities/activity.entity';
import { ActivityRepository } from '../repositories/activity.repository';

@Injectable()
export class ActivityService {

    constructor(
        private readonly activityRepository: ActivityRepository
    ) {}

    /**
     * Return last activity entry by currently logged in user.
     * Internally this uses the findLatestByUser() function.
     * @param authentication Authentication object of user.
     * @returns Activity
     */
    public async findLatestByCurrentUser(authentication: User): Promise<Activity> {
        return this.findLatestByUser(authentication.id, authentication);
    }

    /**
     * Request last activity entry by a specific user.
     * @param userId User's id
     * @param requester Authentication object of the requester. This is used to get metadata like is the song liked by the requester.
     * @returns Activity
     */
    public async findLatestByUser(userId: string, requester: User): Promise<Activity> {
        return this.activityRepository.createQueryBuilder("activity")
            .leftJoin("activity.song", "song")
            .leftJoin("song.artwork", "artwork")
            .leftJoin("song.artists", "artist")
            .loadRelationCountAndMap("song.liked", "song.likedBy", "likedBy", (qb) => qb.where("likedBy.userId = :userId", { userId: requester?.id }))
            .addSelect(["song.id", "song.title", "song.duration", "song.slug", "artwork.id", "artwork.accentColor", "artist.id", "artist.slug", "artist.name"])
            .where("activity.userId = :userId", { userId })
            .orderBy("activity.streamedAt", "DESC")
            .getOne()
    }

    /**
     * Create a new activity entry for a user.
     * @param createActivityDto Activity's data
     * @param authentication Authentication Object of the user to create activity for
     */
    public async addActivity(createActivityDto: CreateActivityDTO, authentication: User): Promise<Activity> {
        return this.activityRepository.save({
            song: createActivityDto.song,
            playlist: createActivityDto.playlist,
            user: authentication
        })
    }

}
