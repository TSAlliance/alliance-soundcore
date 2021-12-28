import path from 'path';
import fs from 'fs';

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { MountRepository } from '../repositories/mount.repository';
import { Mount } from '../entities/mount.entity';
import { CreateMountDTO } from '../dto/create-mount.dto';
import { BucketRepository } from '../repositories/bucket.repository';
import { DeleteResult } from 'typeorm';
import { UpdateMountDTO } from '../dto/update-mount.dto';
import { Index } from "../../index/entities/index.entity";
import { IndexService } from "../../index/index.service";
import { BUCKET_ID, MOUNT_ID } from "../../shared/shared.module";
import { IndexStatus } from '../../index/enum/index-status.enum';
import { SSOUser } from '@tsalliance/sso-nest';

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

    public async findPage(pageable: Pageable): Promise<Page<Mount>> {
        return this.mountRepository.findAll(pageable);
    }

    public async findById(mountId: string): Promise<Mount> {
        return this.mountRepository.findOne({ where: { id: mountId }});
    }

    public async findByIdWithRelations(mountId: string): Promise<Mount> {
        return this.mountRepository.findOne({ where: { id: mountId }, relations: ["bucket"]});
    }

    public async findDefaultMount(): Promise<Mount> {
        return this.mountRepository.findOne({ where: { id: this.mountId }});
    }

    public async findByBucketId(bucketId?: string): Promise<Mount[]> {
        return this.mountRepository.find({ where: { bucket: { id: bucketId || this.bucketId } }});
    }

    public async existsByNameInBucket(bucketId: string, name: string): Promise<boolean> {
        return !!(await this.mountRepository.findOne({ where: { name, bucket: { id: bucketId } }}));
    }

    public async existsByPathInBucket(bucketId: string, path: string): Promise<boolean> {
        return !!(await this.mountRepository.findOne({ where: { path, bucket: { id: bucketId } }}));
    }

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
        return this.mountRepository.save(createMountDto);    
    }

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

    public async update(mountId: string, updateMountDto: UpdateMountDTO): Promise<Mount> {
        const mount = await this.findById(mountId);

        if(!mount || !mount.bucket) {
            throw new NotFoundException("Could not find mount or the bucket the mount belongs to.")
        }

        if(updateMountDto.name) mount.name = updateMountDto.name;
        if(updateMountDto.path) mount.path = path.resolve(updateMountDto.path);

        if(updateMountDto.name && await this.existsByNameInBucket(mount.bucket.id, updateMountDto.name)) {
            throw new BadRequestException("Mount with that name already exists in bucket.");
        }

        if(updateMountDto.path && await this.existsByPathInBucket(mount.bucket.id, updateMountDto.path)) {
            throw new BadRequestException("Mount with that path already exists in bucket.");
        }

        fs.mkdirSync(mount.path, { recursive: true })
        return this.mountRepository.save(mount);
    }

    public async delete(mountId: string): Promise<DeleteResult> {
        return this.mountRepository.delete({ id: mountId })
    }

    /**
     * Init indexing process for a file in a mount.
     * @param mount Mount context
     * @param filename File to be indexed
     * @returns Index
     */
    public async mountFile(mount: Mount, filename: string, uploader?: SSOUser): Promise<Index> {
        return this.indexService.createIndex(mount, filename, uploader);
    }

    /**
     * Check if files inside of mount are indexed or not. If not, then the reindexing process is triggered.
     * @param mount Mount to check
     */
    public async checkIndicesOfMount(mount: Mount): Promise<void> {
        const mountDir = path.join(mount.path);

        if(!fs.existsSync(mountDir)) {
            this.logger.warn(`Directory for mount '${mount.name}' not found. Was looking for: ${mountDir}`);
            return;
        }

        const indices: string[] = (await this.indexService.findAllByMount(mount.id)).filter((index) => index.status != IndexStatus.ERRORED).map((index) => index.filename);
        const files: string[] = fs.readdirSync(mountDir, { withFileTypes: true }).filter((file) => file.isFile()).map((file) => file.name);
        const notIndexedFiles: string[] = files.filter((file) => !indices.includes(file));
            
        if(notIndexedFiles.length <= 0) return;

        this.logger.warn(`Found ${notIndexedFiles.length} files that require indexing. Indexing now in background...`);
            
        for(const filename of notIndexedFiles) {
            // TODO: Maybe build queuing system? Currently awaiting finish of one process at a time.
            await this.indexService.createIndex(mount, filename)
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

}
