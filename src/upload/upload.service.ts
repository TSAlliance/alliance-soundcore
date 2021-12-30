import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SSOUser } from '@tsalliance/sso-nest';
import { MountService } from '../bucket/services/mount.service';
import { Index } from '../index/entities/index.entity';
import { StorageService } from '../storage/storage.service';
import { Formats } from './dto/formats.dto';

@Injectable()
export class UploadService {

    constructor(private storageService: StorageService, private mountService: MountService){}

    /**
     * Get a list of supported formats for image or audio files
     * @returns Formats
     */
    public async findSupportedFormats(): Promise<Formats> {
        return new Formats()
    }

    /**
     * Process an uploaded file by specific uploader.
     * @param file Uploaded file
     * @param uploader User that uploaded the file.
     * @returns Index
     */
    public async uploadAudio(file: Express.Multer.File, uploader: SSOUser): Promise<Index> {
        const mount = await this.mountService.findDefaultMount();
        if(!mount) throw new NotFoundException("Could not find default mount.");

        if(!await (await this.findSupportedFormats()).audio.includes(file.mimetype)) throw new BadRequestException("Unsupported file format.")

        return this.storageService.writeBufferToMount(mount, file.buffer, file.originalname).catch((error) => error).then((value) => {
            console.log(value)
            if(value) throw new InternalServerErrorException("Could not upload file: Unexpected error.");

            return this.mountService.mountFile(mount, file.originalname, uploader)
        });
    }

}
