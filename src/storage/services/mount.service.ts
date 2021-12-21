import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { existsSync, mkdirSync } from "fs";
import { Page, Pageable } from "nestjs-pager";
import { resolve } from "path";
import { DeleteResult } from "typeorm";
import { CreateMountDTO } from "../dto/create-mount.dto";
import { UpdateMountDTO } from "../dto/update-mount.dto";
import { StorageBucket } from "../entities/storage-bucket.entity";
import { StorageMount } from "../entities/storage-mount.entity";
import { MountRepository } from "../repositories/mount.repository";
import { StorageBucketService } from "./bucket.service";
import { StorageService } from "./storage.service";

@Injectable()
export class StorageMountService {

    private logger: Logger = new Logger("StorageBucket")

    constructor(
        private storageService: StorageService,
        private bucketService: StorageBucketService,
        private mountRepository: MountRepository
    ) {}

    public async findAllByBucketId(bucketId: string, pageable: Pageable): Promise<Page<StorageMount>> {
        return this.mountRepository.findAll(pageable, { where: { bucket: { id: bucketId }}})
    }

    public async findById(mountId: string): Promise<StorageMount> {
        return this.mountRepository.findOne({ where: { id: mountId }})
    }

    public async existsByPath(path: string): Promise<boolean> {
        return !!(await this.mountRepository.findOne({ where: { path: path }}))
    }

    /**
     * Create new mountpoint for bucket.
     * @param createMountDto 
     * @returns 
     */
    public async create(createMountDto: CreateMountDTO): Promise<StorageMount> {
        let bucket: StorageBucket = null;
        
        if(createMountDto.bucketId) bucket = await this.bucketService.findById(createMountDto.bucketId);
        else bucket = await this.bucketService.findSelfBucket();

        if(!bucket) throw new BadRequestException("Could not find storage bucket.")

        if(await this.existsByPath(createMountDto.path)) throw new BadRequestException("Path already mounted.")
        const path = resolve(createMountDto.path)

        try {
            if(!existsSync(path)) {
                if(!createMountDto.createIfNotExists) {
                    throw new BadRequestException("Path does not exist in filesystem.")
                }

                mkdirSync(path, { recursive: true })
                console.log(path)
            }
        } catch (error) {
            throw new InternalServerErrorException(error.message)
        }

        const mount = new StorageMount();
        mount.path = path;
        mount.bucket = bucket;
        
        return this.mountRepository.save(mount);
    }

    /**
     * Update existing mount
     * @param updateMountDto 
     * @returns 
     */
    public async update(mountId: string, updateMountDto: UpdateMountDTO): Promise<StorageMount> {
        const mount = await this.findById(mountId)
        if(!mount) throw new NotFoundException("Mount not found")

        const destDir = updateMountDto.path;

        if(destDir && destDir != mount.path) {
            if(await this.existsByPath(destDir)) throw new BadRequestException("Path already mounted.")

            mount.path = destDir;
            const result = await this.mountRepository.save(mount);

            mkdirSync(destDir, { recursive: true })
            return result;
        }
        
        return mount;
    }

    /**
     * Delete a mount.
     * @param mountId Mount id to delete
     * @returns 
     */
    public async delete(mountId: string): Promise<DeleteResult> {
        return this.mountRepository.delete({ id: mountId })
    }

}