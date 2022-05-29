import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { RandomUtil } from '@tsalliance/rest';
import Bull, { Queue } from 'bull';
import { Page, Pageable } from 'nestjs-pager';
import path from 'path';
import fs from "fs";
import { DeleteResult } from 'typeorm';
import { Bucket } from '../../bucket/entities/bucket.entity';
import { QUEUE_MOUNTSCAN_NAME } from '../../constants';
import { BUCKET_ID } from '../../shared/shared.module';
import { StorageService } from '../../storage/storage.service';
import { CreateMountDTO } from '../dtos/create-mount.dto';
import { UpdateMountDTO } from '../dtos/update-mount.dto';
import { Mount } from '../entities/mount.entity';
import { MountRepository } from '../repositories/mount.repository';
import { MountScan } from '../entities/scan.entity';
import { MountScanResultDTO } from '../dtos/scan-result.dto';
import { FileService } from '../../file/services/file.service';

@Injectable()
export class MountService {
    private logger: Logger = new Logger(MountService.name);

    constructor(
        private readonly repository: MountRepository,
        private readonly storage: StorageService,
        private readonly fileService: FileService,
        @Inject(BUCKET_ID) private readonly bucketId: string,
        @InjectQueue(QUEUE_MOUNTSCAN_NAME) private readonly queue: Queue<MountScan>
    ) {
        this.queue.on("completed", (job, result: MountScanResultDTO) => {
            for(const file of result.files) {
                this.fileService.processFile({
                    file,
                    dbOptions: {
                        port: parseInt(process.env.DB_PORT),
                        host: process.env.DB_HOST,
                        database: process.env.DB_NAME,
                        password: process.env.DB_PASS,
                        username: process.env.DB_USER,
                        prefix: process.env.DB_PREFIX
                    }
                });
            }
        });
    }

    /**
     * Find a list of mounts inside a bucket.
     * @param bucketId Bucket's id
     * @param pageable Page settings
     * @returns Page<Mount>
     */
    public async findByBucketId(bucketId: string, pageable: Pageable): Promise<Page<Mount>> {
        if(!pageable) throw new BadRequestException("Missing page settings");

        const result = await this.repository.createQueryBuilder("mount")
            .leftJoinAndSelect("mount.bucket", "bucket")
            .where("bucket.id = :bucketId", { bucketId })
            .getManyAndCount();
        
        return Page.of(result[0], result[1]);
    }

    /**
     * Find a mount by its id including the bucket relationship.
     * @param mountId Mount's id
     * @returns Mount
     */
    public async findById(mountId: string): Promise<Mount> {
        return this.repository.findOne({ where: { id: mountId }, relations: ["bucket"]});
    }

    /**
     * Find the default mount of a bucket
     * @param bucketId Bucket's id
     * @returns Mount
     */
    public async findDefaultOfBucket(bucketId: string): Promise<Mount> {
        return await this.repository.findOne({ where: { isDefault: true, bucket: { id: bucketId }}, relations: ["bucket"]});
    }

    /**
     * Find the default mount of current bucket
     * @returns Mount
     */
    public async findDefault(): Promise<Mount> {
        return this.findDefaultOfBucket(this.bucketId);
    }

    /**
     * Check if a mount with certain name already exists inside bucket
     * @param bucketId Bucket's id
     * @param name Name of the bucket
     * @returns True or False
     */
    public async existsByNameInBucket(bucketId: string, name: string): Promise<boolean> {
        return !!(await this.repository.findOne({ where: { name, bucket: { id: bucketId } }}));
    }

    /**
     * Check if a mount with certain path already exists inside bucket
     * @param bucketId Bucket's id
     * @param path Path of the bucket
     * @returns True or False
     */
    public async existsByPathInBucket(bucketId: string, directory: string): Promise<boolean> {
        return !!(await this.repository.findOne({ where: { directory, bucket: { id: bucketId } }}));
    }

    /**
     * Trigger scan for a mount. This will create a new job and add it
     * to the directory scan queue.
     * @param idOrObject Mount ID or Object
     * @returns Job<Mount>
     */
    public async rescanMount(idOrObject: string | Mount): Promise<Bull.Job<MountScan>> {
        const mount = await this.resolveMount(idOrObject);
        return this.queue.add(new MountScan(mount), { jobId: mount.id });
    }

    /**
     * Create new mount in database.
     * @param createMountDto Mount data
     * @returns Mount
     */
    public async create(createMountDto: CreateMountDTO): Promise<Mount> {
        const mount = this.repository.create();
        mount.name = createMountDto.name;
        mount.directory = createMountDto.directory;
        mount.bucket = { id: createMountDto.bucketId } as Bucket;

        return new Promise<Mount>((resolve, reject) => {
            fs.mkdir(createMountDto.directory, { recursive: true }, (err: Error) => {
                if(err) {
                    reject(new InternalServerErrorException("Could not create mount directory."));
                } else {
                    this.repository.save(mount).then((mount) => {
                        if(createMountDto.setAsDefault) this.setDefaultMount(mount);
                        if(createMountDto.doScan) this.rescanMount(mount);
                        resolve(mount);
                    });
                }
            });
        });
    }

    /**
     * Update existing mount.
     * @param mountId Mount's id
     * @param updateMountDto Mount's updated data
     * @returns Mount
     */
    public async update(mountId: string, updateMountDto: UpdateMountDTO): Promise<Mount> {
        const mount = await this.findById(mountId);

        if(!mount || !mount.bucket) {
            throw new NotFoundException("Could not find mount or the bucket the mount belongs to.")
        }

        if(updateMountDto.name) mount.name = updateMountDto.name;
        if(updateMountDto.directory) mount.directory = path.resolve(updateMountDto.directory);

        if(updateMountDto.name && updateMountDto.name != mount.name && await this.existsByNameInBucket(mount.bucket.id, updateMountDto.name)) {
            throw new BadRequestException("Mount with that name already exists in bucket.");
        }

        if(updateMountDto.directory && updateMountDto.directory != mount.directory && await this.existsByPathInBucket(mount.bucket.id, updateMountDto.directory)) {
            throw new BadRequestException("Mount with that path already exists in bucket.");
        }

        fs.mkdirSync(mount.directory, { recursive: true })
        return this.repository.save(mount).then((mount) => {
            if(updateMountDto.setAsDefault) this.setDefaultMount(mount);
            if(updateMountDto.doScan) this.rescanMount(mount);
            return mount;
        });
    }

    /**
     * Check if there is a default mount existing
     * for the current bucket.
     * If not, a mount is created and will be set as
     * default.
     */
    public async checkForDefaultMount() {
        const defaultMount = await this.findDefaultOfBucket(this.bucketId);
        if(!defaultMount) {
            return this.create({
                bucketId: this.bucketId,
                directory: path.join(this.storage.getSoundcoreDir(), RandomUtil.randomString(32)),
                name: `Default Mount #${RandomUtil.randomString(4)}`,
                setAsDefault: true
            });
        }

        return defaultMount;
    }

    /**
     * Set a mount to the default mount inside its bucket.
     * @param idOrObject Mount Object or ID
     * @returns Mount
     */
    public async setDefaultMount(idOrObject: string | Mount): Promise<Mount> {
        const mount = await this.resolveMount(idOrObject);
        mount.isDefault = true;

        return this.repository.manager.transaction<Mount>(async (manager) => {
            await manager.createQueryBuilder().update(Mount).set({ isDefault: false }).where("isDefault = :isDefault AND bucketId = :bucketId", { isDefault: true, bucketId: mount.bucket.id }).execute();
            return manager.save(mount).then((m) => {
                this.logger.log(`Set mount '${mount.name}' as default mount.`);
                return m;
            });
        })
    }

    /**
     * Check mounts on current bucket.
     * This will read all mounts from the database and add them
     * to the scanner queue for directory scanning.
     */
    public async checkMounts() {
        const options: Pageable = { page: 0, size: 30 }

        let page: Page<Mount>;
        let fetchedElements = 0;
    
        while(fetchedElements < page?.totalElements || page == null) {
            page = await this.findByBucketId(this.bucketId, options);
            options.page++;
            fetchedElements += page.amount;

            for(const mount of page.elements) {
                this.rescanMount(mount);
            }
        }
    }

    /**
     * Delete mount by its id.
     * @param mountId Mount's id
     * @returns DeleteResult
     */
    public async delete(mountId: string): Promise<DeleteResult> {
        return this.repository.delete({ id: mountId })
    }

    /**
     * Resolves a value to a mount object. The parameter must be either a valid mount id
     * or the mount object itself.
     * @param idOrObject Mount or Mount id
     * @returns Mount
     */
    private async resolveMount(idOrObject: string | Mount): Promise<Mount> {
        if(typeof idOrObject == "string") {
            return await this.findById(idOrObject);
        } else {
            return idOrObject;
        }
    }

}
