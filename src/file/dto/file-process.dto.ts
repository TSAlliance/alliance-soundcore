import { FileDTO } from "../../mount/dtos/file.dto";

export class FileProcessDTO {

    public file: FileDTO;
    public dbOptions: {
        port: number,
        host: string,
        database: string,
        username: string,
        password: string,
        prefix: string
    }

}