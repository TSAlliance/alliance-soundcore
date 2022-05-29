import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { Page, Pageable } from 'nestjs-pager';
import { QUEUE_FILE_NAME } from '../../constants';
import { FileProcessDTO } from '../dto/file-process.dto';
import { File } from '../entities/file.entity';
import { FileRepository } from '../repositories/file.repository';

@Injectable()
export class FileService {

    constructor(
        private readonly repository: FileRepository,
        @InjectQueue(QUEUE_FILE_NAME) private readonly queue: Queue<FileProcessDTO>
    ) {
        this.queue.on("failed", (job, err) => {
            console.log("failed #", job.id);
            console.error(err);
        })
        this.queue.on("active", (job) => {
            console.log("active #", job.id);
        })
        this.queue.on("completed", (job) => {
            console.log("completed #", job.id);
        })


        this.queue.on("error", (error: Error) => {
            console.error(error);
        })



    }

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

    /**
     * Trigger the processing of a file. This will add the file
     * to a queue. The queue's processor creates all needed database entries, metadata etc.
     * @param fileDto Data to feed into the Queue (Processor)
     */
    public async processFile(fileDto: FileProcessDTO) {
        this.queue.add(fileDto).then((job) => {
            console.log("added job to queue ", job.id)
        });
    }

}
