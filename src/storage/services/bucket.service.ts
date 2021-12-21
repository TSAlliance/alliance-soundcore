import { Injectable, Logger } from "@nestjs/common";
import { RandomUtil } from "@tsalliance/rest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import os from "os"
import { BucketRepository } from "../repositories/bucket.repository";
import { StorageBucket } from "../entities/storage-bucket.entity";
import { Page, Pageable } from "nestjs-pager";

@Injectable()
export class StorageBucketService {

    private logger: Logger = new Logger("StorageBucket")
    private _machineId: string;

    constructor(private bucketRepository: BucketRepository) {
        this._machineId = this.createOrReadMachineId();
        this.logger.log(`Identified machine as ${this._machineId}`)
    }

    public get machineId(): string {
        return this._machineId;
    }

    public async findById(bucketId: string): Promise<StorageBucket> {
        return this.bucketRepository.findOne({ where: { id: bucketId }})
    }

    public async findAll(pageable: Pageable): Promise<Page<StorageBucket>> {
        const selfBucket = await this.findSelfBucket();

        if(selfBucket.isolated) {
            return this.bucketRepository.findAll(pageable, { where: { machineId: selfBucket.machineId }})
        } else {
            return this.bucketRepository.findAll(pageable, { where: { isolated: 0 }})
        }
    }

    public async findSelfBucket(): Promise<StorageBucket> {
        const machineId: string = await this.createOrReadMachineId();
        return this.bucketRepository.findOne({ where: { machineId }})
    }

    private createOrReadMachineId(): string {
        const userDir: string = os.homedir();
        const soundcoreDir: string = join(userDir, ".soundcore")
        const machineIdFile: string = join(soundcoreDir, ".soundcoreId")
        let machineId: string = null;

        if(!existsSync(soundcoreDir)) mkdirSync(soundcoreDir, { recursive: true })
        if(!existsSync(machineIdFile)) {
            machineId = RandomUtil.randomString(64)
            writeFileSync(machineIdFile, machineId);
        } else {
            machineId = readFileSync(machineIdFile, "utf-8");
        }

        // Create bucket in database if not exists
        this.bucketRepository.findOne({ where: { machineId }}).catch(() => null).then((bucket) => {
            if(!bucket) this.bucketRepository.save({ machineId })
        })
        
        return machineId;
    }

}