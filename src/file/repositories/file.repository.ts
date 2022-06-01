import { PageableRepository } from "nestjs-pager";
import { EntityRepository } from "typeorm";
import { FileDTO } from "../../mount/dtos/file.dto";
import { File, FileFlag } from "../entities/file.entity";

@EntityRepository(File)
export class FileRepository extends PageableRepository<File> {

    /**
     * Find or create a file entry by the given data.
     * This will return the file and a boolean, indicating if the
     * file already existed.
     * @param fileDto Info about the file
     * @returns [File, boolean]
     */
    public async findOrCreateFile(fileDto: FileDTO): Promise<[File, boolean]> {
        return this.manager.transaction((entityManager) => {
            return entityManager.createQueryBuilder(File, "file")
                .where({ name: fileDto.filename, directory: fileDto.directory, mount: { id: fileDto.mount.id }})
                .getOne().then(async (result) => {
                    if(typeof result == "undefined" || result == null) {
                        const file = new File();
                        file.flag = FileFlag.OK;
                        file.mount = fileDto.mount;
                        file.directory = fileDto.directory;
                        file.name = fileDto.filename;
                        file.size = fileDto.size || 0;
    
                        return [await entityManager.save(file), false];
                    }

                    return [result, false];
                });
        })
    }

    /*private async findOrCreateUsingLock(fileDto: FileDTO): Promise<File> {
        return this.manager.transaction((entityManager) => {
            return entityManager.createQueryBuilder(File, "file")
                .setLock("optimistic", new Date())
                .where({ name: fileDto.filename, directory: fileDto.directory, mount: { id: fileDto.mount.id }})
                .getOne().then(async (result) => {
                    if(typeof result == "undefined" || result == null) {
                        const file = new File();
                        file.flag = FileFlag.OK;
                        file.mount = fileDto.mount;
                        file.directory = fileDto.directory;
                        file.name = fileDto.filename;
    
                        return await entityManager.save(file);
                    }
                    return result;
                });
        })
    }

    public async findOrCreateFile(fileDto: FileDTO): Promise<File> {
        const maxTries = 10;
        let currentTry = 0;
        let tryAgain = true;

        let file: File;
        while(tryAgain) {
            currentTry++;

            try {
                file = await this.findOrCreateUsingLock(fileDto);
            } catch (e) {}

            if(typeof file == "undefined" || file == null) {
                tryAgain = false;
            }

            if(currentTry >= maxTries) {
                throw new Error("Reached maximum retries: Deadlock found on resource.");
            }
        }

        return file;
    }*/

}