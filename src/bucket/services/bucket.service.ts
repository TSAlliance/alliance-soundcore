import { BadRequestException, Injectable } from '@nestjs/common';
import { Page, Pageable } from 'nestjs-pager';
import { Bucket } from '../entities/bucket.entity';
import { BucketRepository } from '../repositories/bucket.repository';
import { CreateBucketDTO } from '../dto/create-bucket.dto';

@Injectable()
export class BucketService {

    public bucketId: string;

    constructor(
        private bucketRepository: BucketRepository,
    ){}

    /**
     * Find a page of buckets.
     * @param pageable Page settings
     * @returns Page<Bucket>
     */
    public async findAll(pageable: Pageable): Promise<Page<Bucket>> {
        const result = await this.bucketRepository.createQueryBuilder("bucket")
            .loadRelationCountAndMap("bucket.mountsCount", "bucket.mounts", "mountsCount")

            .offset((pageable?.page || 0) * (pageable?.size || 30))
            .limit(pageable?.size || 30)

            .getManyAndCount()

        return Page.of(result[0], result[1], pageable.page);
    }

    /**
     * Find a bucket by its id.
     * @param bucketId Bucket's id
     * @returns Bucket
     */
    public async findById(bucketId: string): Promise<Bucket> {
        const result = await this.bucketRepository.createQueryBuilder("bucket")
            .loadRelationCountAndMap("bucket.mountsCount", "bucket.mounts", "mountsCount")
            .where("bucket.id = :bucketId", { bucketId })
            .getOne()

        return result;
    }

    /**
     * Check if a bucket with name already exists.
     * @param name Name of the bucket
     * @returns True or False
     */
    public async existsByName(name: string): Promise<boolean> {
        return !!(await this.bucketRepository.findOne({ where: { name }}));
    }

    /**
     * Create new bucket providing a predefined id.
     * @param bucketId Predefined id
     * @param createBucketDto Bucket data
     * @returns Bucket
     */
    public async createWithId(bucketId: string, createBucketDto: CreateBucketDTO): Promise<Bucket> {
        const bucket = await this.findById(bucketId);
        if(bucket) return bucket;

        if(await this.existsByName(createBucketDto.name)) {
            throw new BadRequestException("Bucket with that name already exists.");
        }
        
        return this.bucketRepository.save({
            ...createBucketDto,
            id: bucketId
        });    
    }

}
