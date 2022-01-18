import path from 'path';
import fs, { mkdirSync } from 'fs';

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { MountRepository } from '../repositories/mount.repository';
import { Mount } from '../entities/mount.entity';
import { CreateMountDTO } from '../dto/create-mount.dto';
import { BucketRepository } from '../repositories/bucket.repository';
import { DeleteResult } from 'typeorm';
import { UpdateMountDTO } from '../dto/update-mount.dto';
import { Index } from "../../index/entities/index.entity";
import { IndexService } from "../../index/services/index.service";
import { BUCKET_ID, MOUNT_ID } from "../../shared/shared.module";
import { IndexStatus } from '../../index/enum/index-status.enum';
import { MountStatus } from '../enums/mount-status.enum';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class MountService {
    private logger: Logger = new Logger(MountService.name);

    constructor(
        private indexService: IndexService,
        private mountRepository: MountRepository, 
        private bucketRepository: BucketRepository,
        @Inject(BUCKET_ID) private bucketId: string,
        @Inject(MOUNT_ID) private mountId: string
    ){}

    /**
     * Find a page of mounts.
     * @param pageable Page settings
     * @returns Page<Mount>
     */
    public async findPage(pageable: Pageable): Promise<Page<Mount>> {
        return this.mountRepository.findAll(pageable);
    }

    /**
     * Find a mount by its id
     * @param mountId Mount's id
     * @returns Mount
     */
    public async findById(mountId: string): Promise<Mount> {
        return this.mountRepository.findOne({ where: { id: mountId }});
    }

    /**
     * Find a mount by its id including all relations.
     * @param mountId Mount's id
     * @returns Mount
     */
    public async findByIdWithRelations(mountId: string): Promise<Mount> {
        return this.mountRepository.findOne({ where: { id: mountId }, relations: ["bucket"]});
    }

    /**
     * Find the default mount of the bucket on this machine.
     * @returns Mount
     */
    public async findDefaultMount(): Promise<Mount> {
        return this.mountRepository.findOne({ where: { id: this.mountId }});
    }

    /**
     * Find all mounts inside a bucket.
     * @param bucketId Bucket's id
     * @returns Mount[]
     */
    public async findByBucketId(bucketId?: string): Promise<Mount[]> {
        return this.mountRepository.find({ where: { bucket: { id: bucketId || this.bucketId } }});
    }

    /**
     * Find a page of mounts inside a bucket.
     * @param bucketId Bucket's id
     * @param pageable Page settings
     * @returns Page<Mount>
     */
    public async findPageByBucketId(bucketId: string, pageable: Pageable): Promise<Page<Mount>> {
        return this.mountRepository.findAll(pageable, { where: { bucket: { id: bucketId }}});
    }

    /**
     * Check if a mount with certain name already exists inside bucket
     * @param bucketId Bucket's id
     * @param name Name of the bucket
     * @returns True or False
     */
    public async existsByNameInBucket(bucketId: string, name: string): Promise<boolean> {
        return !!(await this.mountRepository.findOne({ where: { name, bucket: { id: bucketId } }}));
    }

    /**
     * Check if a mount with certain path already exists inside bucket
     * @param bucketId Bucket's id
     * @param path Path of the bucket
     * @returns True or False
     */
    public async existsByPathInBucket(bucketId: string, path: string): Promise<boolean> {
        return !!(await this.mountRepository.findOne({ where: { path, bucket: { id: bucketId } }}));
    }

    /**
     * Create new mount. If no bucketId is provided, then the bucket of the current machine is used.
     * On success, the indexing process is triggered automatically.
     * @param createMountDto New mount's data
     * @returns Mount
     */
    public async create(createMountDto: CreateMountDTO): Promise<Mount> {
        const bucketId: string = createMountDto.bucket?.id || this.bucketId;
        
        createMountDto.bucket = { id: bucketId }
        createMountDto.path = path.resolve(createMountDto.path);

        if(!await this.bucketRepository.findOne({ where: { id: bucketId }})) {
            throw new NotFoundException("Bucket not found.")
        }

        if(await this.existsByNameInBucket(bucketId, createMountDto.name)) {
            throw new BadRequestException("Mount with that name already exists in bucket.");
        }

        if(await this.existsByPathInBucket(bucketId, createMountDto.path)) {
            throw new BadRequestException("Mount with that path already exists in bucket.");
        }
        
        fs.mkdirSync(createMountDto.path, { recursive: true })

        const mount = await this.mountRepository.save(createMountDto);
        this.checkIndicesOfMount(mount)
        return mount;    
    }

    /**
     * Create new mount providing a predefined id.
     * @param mountId Predefined id.
     * @param createMountDto Mount's data
     * @returns Mount
     */
    public async createWithId(mountId: string, createMountDto: CreateMountDTO): Promise<Mount> {
        const bucketId: string = createMountDto.bucket?.id || this.bucketId;
        
        createMountDto.bucket = { id: bucketId }
        createMountDto.path = path.resolve(createMountDto.path);

        if(!await this.bucketRepository.findOne({ where: { id: bucketId }})) {
            throw new NotFoundException("Bucket not found.")
        }

        if(await this.existsByNameInBucket(bucketId, createMountDto.name)) {
            throw new BadRequestException("Mount with that name already exists in bucket.");
        }

        if(await this.existsByPathInBucket(bucketId, createMountDto.path)) {
            throw new BadRequestException("Mount with that path already exists in bucket.");
        }
        
        fs.mkdirSync(createMountDto.path, { recursive: true })
        return this.mountRepository.save({
            ...createMountDto,
            id: mountId
        });    
    }

    /**
     * Update existing mount.
     * @param mountId Mount's id
     * @param updateMountDto Mount's updated data
     * @returns Mount
     */
    public async update(mountId: string, updateMountDto: UpdateMountDTO): Promise<Mount> {
        const mount = await this.findByIdWithRelations(mountId);

        if(!mount || !mount.bucket) {
            throw new NotFoundException("Could not find mount or the bucket the mount belongs to.")
        }

        if(updateMountDto.name) mount.name = updateMountDto.name;
        if(updateMountDto.path) mount.path = path.resolve(updateMountDto.path);

        if(updateMountDto.name && updateMountDto.name != mount.name && await this.existsByNameInBucket(mount.bucket.id, updateMountDto.name)) {
            throw new BadRequestException("Mount with that name already exists in bucket.");
        }

        if(updateMountDto.path && updateMountDto.path != mount.path && await this.existsByPathInBucket(mount.bucket.id, updateMountDto.path)) {
            throw new BadRequestException("Mount with that path already exists in bucket.");
        }

        fs.mkdirSync(mount.path, { recursive: true })
        return this.mountRepository.save(mount);
    }

    /**
     * Delete mount by its id.
     * @param mountId Mount's id
     * @returns DeleteResult
     */
    public async delete(mountId: string): Promise<DeleteResult> {
        return this.mountRepository.delete({ id: mountId })
    }

    /**
     * Init indexing process for a file in a mount.
     * @param mount Mount context
     * @param filename File to be indexed
     * @returns Index
     */
    public async mountFile(mount: Mount, filename: string, uploader?: User): Promise<Index> {
        return this.indexService.createIndex(mount, filename, uploader);
    }

    /**
     * Check if files inside of mount are indexed or not. If not, then the reindexing process is triggered.
     * @param mount Mount to check
     */
    public async checkIndicesOfMount(mount: Mount): Promise<void> {
        const mountDir = path.join(mount.path);

        if(!fs.existsSync(mountDir)) {
            this.logger.warn(`Directory for mount '${mount.name}' not found. Was looking for: ${mountDir}. Creating it...`);
            mkdirSync(mountDir, { recursive: true })
        }

        const indices: string[] = (await this.indexService.findAllByMount(mount.id)).filter((index) => index.status != IndexStatus.ERRORED).map((index) => index.filename);
        const files: string[] = fs.readdirSync(mountDir, { withFileTypes: true }).filter((file) => file.isFile()).map((file) => file.name);
        const notIndexedFiles: string[] = files.filter((file) => !indices.includes(file));
            
        if(notIndexedFiles.length > 0) {
            // TODO: this.setStatus(mount, MountStatus.INDEXING)
            this.logger.warn(`Found ${notIndexedFiles.length} files that require indexing. Indexing mount '${mount.name}'...`);
                
            for(const filename of notIndexedFiles) {
                this.indexService.createIndex(mount, filename)
            }

            // TODO: this.setStatus(mount, MountStatus.OK)
        }
    }

    /**
     * Check if files inside of all mounts from this bucket are indexed or not. If not, then the reindexing process is triggered.
     */
    public async checkLocalIndices(): Promise<void> {
        const mounts = await this.findByBucketId(this.bucketId);
        if(!mounts || mounts.length <= 0) return;

        for(const mount of mounts) {
            await this.checkIndicesOfMount(mount);
        }
        
    }

    /**
     * Update the status of a mount. This updated the database entry and sends status update to clients on the websocket.
     * @param mount Mount to update
     * @param status Updated status
     * @returns Mount
     */
    public async setStatus(mount: Mount, status: MountStatus): Promise<Mount> {
        mount.status = status;
        await this.mountRepository.save(mount);
        // TODO: Send update to sockets
        return mount;
    }

}
