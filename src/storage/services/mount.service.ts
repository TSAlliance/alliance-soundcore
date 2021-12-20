import { Injectable, Logger } from "@nestjs/common";
import { MountRepository } from "../repositories/mount.repository";

@Injectable()
export class StorageMountService {

    private logger: Logger = new Logger("StorageBucket")

    constructor(private mountRepository: MountRepository) {}

}