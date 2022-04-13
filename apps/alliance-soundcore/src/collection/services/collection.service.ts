import { Injectable } from "@nestjs/common";
import { Collection } from "../entities/collection.entity";
import { LikeRepository } from "../repositories/like.repository";

@Injectable()
export class CollectionService {

    constructor(private likeRepository: LikeRepository) {}

    public async findByUserId(userId: string): Promise<Collection> {
        const result = await this.likeRepository.createQueryBuilder("like")
            .leftJoin("like.song", "song")
            .select(["SUM(song.duration) AS totalDuration", "COUNT(song.id) AS songsCount"])
            .where("like.userId = :userId", { userId })
            .getRawOne()

        const collection = new Collection()
        collection.songsCount = parseInt(result["songsCount"]) || 0;
        collection.totalDuration = parseInt(result["totalDuration"]) || 0;

        return collection;
    }

}