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

    public async findPage(pageable: Pageable): Promise<Page<Bucket>> {
        return this.bucketRepository.findAll(pageable);
    }

    public async findById(bucketId: string): Promise<Bucket> {
        return this.bucketRepository.findOne({ where: { id: bucketId }});
    }

    public async existsByName(name: string): Promise<boolean> {
        return !!(await this.bucketRepository.findOne({ where: { name }}));
    }

    public async create(createBucketDto: CreateBucketDTO): Promise<Bucket> {
        if(await this.existsByName(createBucketDto.name)) {
            throw new BadRequestException("Bucket with that name already exists.");
        }

        return this.bucketRepository.save(createBucketDto);    
    }

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
