import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SSOUser } from '@tsalliance/sso-nest';
import { MountService } from '../bucket/services/mount.service';
import { Index } from '../index/entities/index.entity';
import { StorageService } from '../storage/storage.service';
import { Formats } from './dto/formats.dto';

@Injectable()
export class UploadService {

    constructor(private storageService: StorageService, private mountService: MountService){}

    public async findSupportedFormats(): Promise<Formats> {
        return new Formats()
    }

    public async uploadAudio(file: Express.Multer.File, uploader: SSOUser): Promise<Index> {
        const mount = await this.mountService.findDefaultMount();
        if(!mount) throw new NotFoundException("Could not find default mount.");

        if(!await (await this.findSupportedFormats()).audio.includes(file.mimetype)) throw new BadRequestException("Unsupported file format.")

        return this.storageService.writeBufferToMount(mount, file.buffer, file.filename).catch((error) => error).then((value) => {
            if(value) throw new InternalServerErrorException("Could not upload file: Unexpected error.");

            return this.mountService.mountFile(mount, file.filename, uploader)
        });
    }

}
