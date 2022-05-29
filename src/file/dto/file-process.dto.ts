import { FileDTO } from "../../mount/dtos/file.dto";

export class FileProcessDBOptions {
    public port: number
    public host: string
    public database: string
    public username: string
    public password: string
    public prefix?: string
}
export class FileProcessDTO {

    public file: FileDTO;
    public dbOptions: FileProcessDBOptions

}