import { Random } from "@tsalliance/utilities";
import fs from "fs";
import os from "os";
import path from "path";

export function defaultMountIdProvider(): string {
    const soundcoreDir = path.join(os.homedir(), ".soundcore");
    const mountFile = path.join(soundcoreDir, ".defaultMount");

    fs.mkdirSync(soundcoreDir, { recursive: true });
    if(!fs.existsSync(mountFile)) {
        fs.writeFileSync(mountFile, Random.randomString(36));
    }

    const mountId = fs.readFileSync(mountFile).toString("utf8");
    return mountId;
}