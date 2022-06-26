import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import Bull, { Queue } from 'bull';
import { Page, Pageable } from 'nestjs-pager';
import path from 'path';
import { DeleteResult, Repository } from 'typeorm';
import { Bucket } from '../../bucket/entities/bucket.entity';
import { EVENT_FILE_FOUND, QUEUE_MOUNTSCAN_NAME } from '../../constants';
import { BUCKET_ID } from '../../shared/shared.module';
import { StorageService } from '../../storage/storage.service';
import { CreateMountDTO } from '../dtos/create-mount.dto';
import { UpdateMountDTO } from '../dtos/update-mount.dto';
import { Mount } from '../entities/mount.entity';
import { MountScanProcessDTO } from '../dtos/mount-scan.dto';
import { MountScanResultDTO } from '../dtos/scan-result.dto';
import { ProgressInfoDTO } from '../worker/progress-info.dto';
import { MountGateway } from '../gateway/mount.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Random } from '@tsalliance/utilities';
import { InjectRepository } from '@nestjs/typeorm';
import sanitizeFilename from "sanitize-filename";
import { CreateResult } from '../../utils/results/creation.result';
import { RedisLockableService } from '../../utils/services/redis-lockable.service';
import { RedlockError } from '../../exceptions/redlock.exception';

@Injectable()
export class MountService extends RedisLockableService {
    private logger: Logger = new Logger(MountService.name);

    constructor(
        @InjectRepository(Mount) private readonly repository: Repository<Mount>,
        private readonly storage: StorageService,
        private readonly gateway: MountGateway,
        private readonly eventEmitter: EventEmitter2,
        @Inject(BUCKET_ID) private readonly bucketId: string,
        @InjectQueue(QUEUE_MOUNTSCAN_NAME) private readonly queue: Queue<MountScanProcessDTO>
    ) {
        super();

        this.queue.on("failed", (job, err) => this.logger.error(`Failed scanning mount '${job?.data?.mount?.name}': ${err.message}`, err.stack));
        this.queue.on("error", (err) => this.logger.error(`Error occured on mount-scan-worker: ${err.message}`, err.stack));
        this.queue.on("progress", (job, progress: ProgressInfoDTO) => {
            this.gateway.sendMountUpdateEvent(job.data.mount, progress);
        })

        this.queue.on("completed", (job, result: MountScanResultDTO) => {
            this.gateway.sendMountUpdateEvent(job.data.mount, null);
            this.updateLastScanned(job.data.mount);

            for(const file of result.files) {
                this.eventEmitter.emit(EVENT_FILE_FOUND, file);
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

        const query = await this.repository.createQueryBuilder("mount")
            .leftJoin("mount.bucket", "bucket")
            .leftJoin("mount.files", "file")
            .loadRelationCountAndMap("mount.filesCount", "mount.files")

            .addSelect("SUM(file.size) AS usedSpace")
            .groupBy("mount.id")
            .where("bucket.id = :bucketId", { bucketId })
        
        const result = await query.getRawAndEntities();
        const totalElements = await query.getCount();
        return Page.of(result.entities.map((mount, index) => {
            mount.usedSpace = result.raw[index]?.usedSpace || 0
            return mount;
        }), totalElements, pageable.page);
    }

    /**
     * Find a mount by its id including the bucket relationship.
     * @param mountId Mount's id
     * @returns Mount
     */
    public async findById(mountId: string): Promise<Mount> {
        return await this.repository.createQueryBuilder("mount")
            .leftJoinAndSelect("mount.bucket", "bucket")
            .leftJoin("mount.files", "file")
            .loadRelationCountAndMap("mount.filesCount", "mount.files")
            .addSelect("SUM(file.size) AS usedSpace")
            .where("mount.id = :mountId", { mountId })
            .getRawAndEntities().then((result) => {
                const mount = result.entities[0];
                if(!mount) throw new NotFoundException("Mount not found.");

                mount.usedSpace = result.raw[0]?.usedSpace || 0;
                return mount;
            });
    }

    /**
     * Find a mount by its name in a specific bucket.
     * @param bucketId Bucket's id
     * @param name Name of the mount
     * @returns Mount
     */
    public async findByNameInBucket(bucketId: string, name: string): Promise<Mount> {
        return await this.repository.findOne({ where: { name, bucket: { id: bucketId } }, relations: ["bucket"]});
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
    public async rescanMount(idOrObject: string | Mount): Promise<Bull.Job<MountScanProcessDTO>> {
        const mount = await this.resolveMount(idOrObject);
        const priority = mount.filesCount;

        return this.queue.add(new MountScanProcessDTO(mount), { priority }).then((job) => {
            this.logger.debug(`Added mount '${mount.name} #${job.id}' to scanner queue.`);
            return job;
        });
    }

    /**
     * Create new mount in database.
     * @param createMountDto Mount data
     * @returns Mount
     */
    public async createIfNotExists(createMountDto: CreateMountDTO): Promise<CreateResult<Mount>> {
        const directory = path.resolve(sanitizeFilename(createMountDto.directory, { replacement: "" }));

        return this.lock(createMountDto.name, async(signal) => {
            const existingMount = await this.findByNameInBucket(createMountDto.bucketId, createMountDto.name);
            if(existingMount) return new CreateResult(existingMount, true);
            if(signal.aborted) throw new RedlockError();

            const mount = new Mount()
            mount.name = createMountDto.name;
            mount.directory = directory;
            mount.bucket = { id: createMountDto.bucketId } as Bucket;

            return this.repository.save(mount).then((result) => {
                if(createMountDto.setAsDefault) this.setDefaultMount(mount);
                if(createMountDto.doScan) this.rescanMount(mount);

                return new CreateResult(result, false);
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
        if(updateMountDto.name && updateMountDto.name != mount.name && await this.existsByNameInBucket(mount.bucket.id, updateMountDto.name)) {
            throw new BadRequestException("Mount with that name already exists in bucket.");
        }
        return this.repository.save(mount);
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
            return this.createIfNotExists({
                bucketId: this.bucketId,
                directory: path.join(this.storage.getSoundcoreDir(), Random.randomString(32)),
                name: `Default Mount #${Random.randomString(4)}`,
                setAsDefault: true,
            });
        }

        return defaultMount;
    }

    /**
     * Set a mount to the default mount inside its bucket.
     * @param bucketId Bucket's id to set default mount in
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
        const options: Pageable = new Pageable(0, 30);

        let page: Page<Mount>;
        let fetchedElements = 0;
    
        while(fetchedElements < page?.totalElements || page == null) {
            page = await this.findByBucketId(this.bucketId, options);
            options.page++;
            fetchedElements += page.size;

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

    /**
     * Update the last scanned date in the database.
     * @param idOrObject Id or Mount object
     * @returns Mount
     */
    private async updateLastScanned(idOrObject: string | Mount): Promise<Mount> {
        const mount = await this.resolveMount(idOrObject);
        mount.lastScannedAt = new Date();

        return this.repository.save(mount);
    }

}
