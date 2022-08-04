import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ArtistModule } from "../artist/artist.module";
import { MeiliSyncer } from "./jobs/sync.job";

@Module({
    imports: [
        ScheduleModule.forRoot(),
        ArtistModule
    ],
    providers: [
        MeiliSyncer
    ]
})
export class CronModule {}