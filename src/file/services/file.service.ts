import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { Page, Pageable } from 'nestjs-pager';
import path from 'path';
import { QUEUE_FILE_NAME } from '../../constants';
import { FileDTO } from '../../mount/dtos/file.dto';
import { DBWorkerOptions } from '../../utils/workers/worker.util';
import { FileProcessDTO } from '../dto/file-process.dto';
import { File } from '../entities/file.entity';
import { FileRepository } from '../repositories/file.repository';

@Injectable()
export class FileService {
    private readonly logger: Logger = new Logger(FileService.name);

    constructor(
        private readonly repository: FileRepository,
        @InjectQueue(QUEUE_FILE_NAME) private readonly queue: Queue<FileProcessDTO>
    ) {
        this.queue.on("failed", (job, err) => {
            const filepath = path.join(job.data.file.mount.directory, job.data.file.directory, job.data.file.filename);
            this.logger.error(`Could not process file '${filepath}': ${err.message}`, err.stack);
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
    public async processFile(file: FileDTO, workerOptions: DBWorkerOptions) {
        const processDto = new FileProcessDTO(file, workerOptions);
        return this.queue.add(processDto);
    }

}
