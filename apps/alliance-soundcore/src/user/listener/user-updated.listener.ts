import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SoundcoreMeiliService } from "@soundcore/soundcore-meili";
import { User } from "../entities/user.entity";

@Injectable()
export class OnUserUpdatedListener {

    constructor(
        private readonly meilisearch: SoundcoreMeiliService
    ) {}

    @OnEvent("user.updated")
    public handleOnUserUpdatedEvent(payload: User) {
        console.log("user updated")
        this.meilisearch.userIndex().addDocuments([{
            id: payload.id,
            username: payload.username
        }])
    }

}