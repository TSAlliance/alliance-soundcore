import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { Page, Pageable } from 'nestjs-pager';
import { QUEUE_FILE_NAME } from '../../constants';
import { FileDTO } from '../../mount/dtos/file.dto';
import { FileProcessDTO } from '../dto/file-process.dto';
import { File } from '../entities/file.entity';
import { FileRepository } from '../repositories/file.repository';

@Injectable()
export class FileService {

    constructor(
        private readonly repository: FileRepository,
        @InjectQueue(QUEUE_FILE_NAME) private readonly queue: Queue<FileProcessDTO>
    ) {}

    /**
     * Find a file by its name and sub-directory in mount.
     * @param name File's name
     * @param directory Sub-Directory in mount
     * @returns File
     */
    public async findByNameAndDirectory(name: string, directory?: string): Promise<File> {
        return this.repository.createQueryBuilder("file")
            .leftJoinAndSelect("file.mount", "mount")
            .where("file.name = :name AND file.directory = :directory", { name, directory })
            .getOne()
    }

    /**
     * Find page of files of a mount.
     * @param mountId Mount's id
     * @param pageable Page settings
     * @returns Page<File>
     */
    public async findByMount(mountId: string, pageable: Pageable): Promise<Page<File>> {
        const result = await this.repository.createQueryBuilder("file")
            .leftJoin("file.mount", "mount")
            .where("mount.id = :mountId", { mountId })
            .getManyAndCount()

        return Page.of(result[0], result[1], pageable.page);
    }

    public async addToQueue(fileDto: FileProcessDTO) {
        this.queue.add(fileDto).then((job) => {
            console.log("added job to queue ", job.id)
        });
    }

}
