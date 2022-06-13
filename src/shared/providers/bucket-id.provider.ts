import { Random } from "@tsalliance/utilities";
import fs from "fs";
import os from "os";
import path from "path";

export function bucketIdProvider(): string {
    const soundcoreDir = path.join(os.homedir(), ".soundcore");
    const soundCoreFile = path.join(soundcoreDir, ".soundcoreId");

    fs.mkdirSync(soundcoreDir, { recursive: true });
    if(!fs.existsSync(soundCoreFile)) {
        fs.writeFileSync(soundCoreFile, Random.randomString(36));
    }

    const bucketId = fs.readFileSync(soundCoreFile).toString("utf8");
    return bucketId;
}