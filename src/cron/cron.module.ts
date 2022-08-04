import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AlbumModule } from "../album/album.module";
import { ArtistModule } from "../artist/artist.module";
import { MeiliSyncer } from "./jobs/sync.job";

@Module({
    imports: [
        ScheduleModule.forRoot(),
        ArtistModule,
        AlbumModule
    ],
    providers: [
        MeiliSyncer
    ]
})
export class CronModule {}