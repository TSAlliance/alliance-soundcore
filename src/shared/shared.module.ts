import { Global, Module } from "@nestjs/common";
import { bucketIdProvider } from "./providers/bucket-id.provider";
import { defaultMountIdProvider } from "./providers/default-mount.provider";

export const BUCKET_ID = "bucketId"
export const MOUNT_ID = "mountId"


@Global()
@Module({
    providers: [
        {
            provide: BUCKET_ID,
            useFactory: bucketIdProvider
        },
        {
            provide: MOUNT_ID,
            useFactory: defaultMountIdProvider
        }
    ],
    exports: [
        BUCKET_ID,
        MOUNT_ID
    ]
})
export class SharedModule {}