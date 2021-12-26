import { Global, Module } from "@nestjs/common";
import { machineIdProvider } from "./providers/machine-id.provider";

export const BUCKET_ID = "bucketId"

@Global()
@Module({
    providers: [
        {
            provide: BUCKET_ID,
            useFactory: machineIdProvider
        }
    ],
    exports: [
        BUCKET_ID
    ]
})
export class SharedModule {}