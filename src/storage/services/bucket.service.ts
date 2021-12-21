import { Injectable, Logger } from "@nestjs/common";
import { RandomUtil } from "@tsalliance/rest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import os from "os"
import { BucketRepository } from "../repositories/bucket.repository";
import { StorageBucket } from "../entities/storage-bucket.entity";
import { Page, Pageable } from "nestjs-pager";
import { StorageMountService } from "./mount.service";

@Injectable()
export class StorageBucketService {

    private logger: Logger = new Logger("StorageBucket")
    public readonly machineId: string;

    constructor(private bucketRepository: BucketRepository, private mountService: StorageMountService) {
        this.machineId = this.createOrReadMachineId();
        this.logger.log(`Identified machine as ${this.machineId}`)
    }

    /**
     * Find a bucket by its id.
     * @param bucketId Id to lookup
     * @returns StorageBucket
     */
    public async findById(bucketId: string): Promise<StorageBucket> {
        return this.bucketRepository.findOne({ where: { id: bucketId }})
    }

    /**
     * Find a page of buckets.
     * @param pageable Page settings
     * @returns Page<StorageBucket>
     */
    public async findAll(pageable: Pageable): Promise<Page<StorageBucket>> {
        const selfBucket = await this.findSelfBucket();

        if(selfBucket.isolated) {
            return this.bucketRepository.findAll(pageable, { where: { machineId: selfBucket.machineId }})
        } else {
            return this.bucketRepository.findAll(pageable, { where: { isolated: 0 }})
        }
    }

    /**
     * Find the bucket database entry for the machine that is running the application.
     * @returns StorageBucket
     */
    public async findSelfBucket(): Promise<StorageBucket> {
        const machineId: string = await this.createOrReadMachineId();
        return this.bucketRepository.findOne({ where: { machineId }})
    }

    /**
     * Check if a bucket with name already exists.
     * @param name Name to lookup
     * @returns True or False
     */
    public async existsByName(name: string): Promise<boolean> {
        return !!(await this.bucketRepository.findOne({ where: { name: name.toLowerCase() }}))
    }

    /**
     * Read the machineId from user's home directory. If it does not exist, an id is generated and saved.
     * NOTE: A new bucket is created. It may happen that the bucket will not be available instantly as it is created in background.
     * @returns string
     */
    private createOrReadMachineId(): string {
        const soundcoreDir: string = this.getSoundcoreDir();
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
            if(!bucket) { 
                this.bucketRepository.save({ 
                    name: os.hostname() + "/" + RandomUtil.randomString(4),
                    machineId
                }).then((bucket) => {
                    this.mountService.create({ bucketId: bucket.id, createIfNotExists: true, path: join(soundcoreDir, bucket.id) })
                })
            }
        })
        
        return machineId;
    }

    public getSoundcoreDir(): string {
        return join(resolve(os.homedir()), ".soundcore");
    }

}