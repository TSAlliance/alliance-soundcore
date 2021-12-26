import os from "os";
import path from 'path';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { RandomUtil } from '@tsalliance/rest';
import { MountRepository } from '../repositories/mount.repository';
import { Mount } from '../entities/mount.entity';
import { CreateMountDTO } from '../dto/create-mount.dto';
import { BucketRepository } from '../repositories/bucket.repository';
import { DeleteResult } from 'typeorm';
import { UpdateMountDTO } from '../dto/update-mount.dto';
import { Index } from "../../index/entities/index.entity";
import { IndexService } from "../../index/index.service";
import { BUCKET_ID } from "../../shared/shared.module";

@Injectable()
export class MountService {

    constructor(
        private indexService: IndexService,
        private mountRepository: MountRepository, 
        private bucketRepository: BucketRepository,
        @Inject(BUCKET_ID) private bucketId: string
    ){}

    public async findPage(pageable: Pageable): Promise<Page<Mount>> {
        return this.mountRepository.findAll(pageable);
    }

    public async findById(bucketId: string): Promise<Mount> {
        return this.mountRepository.findOne({ where: { id: bucketId }});
    }

    public async findByIdWithRelations(bucketId: string): Promise<Mount> {
        return this.mountRepository.findOne({ where: { id: bucketId }, relations: ["bucket"]});
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
        
        mkdirSync(createMountDto.path, { recursive: true })
        return this.mountRepository.save(createMountDto);    
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

        mkdirSync(mount.path, { recursive: true })
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
    public async mountFile(mount: Mount, filename: string): Promise<Index> {
        return this.indexService.createIndex(mount, filename);
    }

    private readBucketId(): string {
        const soundcoreDir = path.join(os.homedir(), ".soundcore");
        const soundCoreFile = path.join(soundcoreDir, ".soundcoreId");

        mkdirSync(soundcoreDir, { recursive: true });
        if(!existsSync(soundCoreFile)) {
            writeFileSync(soundCoreFile, RandomUtil.randomString(36));
        }

        const bucketId = readFileSync(soundCoreFile).toString("utf8");
        return bucketId;
    }

}
