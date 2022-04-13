import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { SoundcoreMeiliService } from "@soundcore/soundcore-meili";
import { User } from "../entities/user.entity";

@Injectable()
export class OnUserCreatedListener {

    constructor(
        private readonly meilisearch: SoundcoreMeiliService
    ) {}

    @OnEvent("user.created")
    public handleOnUserCreatedEvent(payload: User) {
        console.log("user created")
        this.meilisearch.userIndex().addDocuments([{
            id: payload.id,
            username: payload.username
        }])
    }

}