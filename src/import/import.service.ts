import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { MountService } from '../bucket/services/mount.service';
import { MOUNT_ID } from '../shared/shared.module';
import { CreateImportDTO } from './dtos/create-import.dto';
import { StorageService } from '../storage/storage.service';

import fs from "fs";
import sanitize from 'sanitize-filename';

import ytdl from "ytdl-core";
import ytpl from 'ytpl';
import { Mount } from '../bucket/entities/mount.entity';
import { IndexService } from '../index/index.service';
import { info } from 'console';

import NodeID3 from 'node-id3';

import { ImportEntity } from './entities/import.entity';
import { ArtworkService } from '../artwork/artwork.service';
import path from 'path';
import { User } from '../user/entities/user.entity';
import { exec, execSync } from 'child_process';
import pathToFfmpeg from 'ffmpeg-static';


@Injectable()
export class ImportService {
    private logger: Logger = new Logger(ImportService.name);

    constructor(
        private mountService: MountService,
        private storageService: StorageService,
        private indexService: IndexService,
        private artworkService: ArtworkService,
        @Inject(MOUNT_ID) private mountId: string
    ) {}

    public async createImport(createImportDto: CreateImportDTO, importer?: User): Promise<ImportEntity> {
        const downloadableUrl = createImportDto.url + "&t=" + (createImportDto.startTime || 0);
        if(!ytdl.validateURL(downloadableUrl)) throw new BadRequestException("Not a valid youtube url.")

        const mount: Mount = await this.mountService.findById(createImportDto.mountId || this.mountId);
        const info: ytdl.videoInfo = await ytdl.getInfo(createImportDto.url).catch((reason) => {
            console.error(reason)
            return null;
        })

        const title = createImportDto.title || info.videoDetails.title;
        const dstFilepath = this.storageService.buildFilepath(mount, title + ".mp3");

        const importEntity = new ImportEntity();
        importEntity.status = "preparing";
        importEntity.downloadableUrl = downloadableUrl;
        importEntity.metadata = {
            title: title.replace(/^(?:\[[^\]]*\]|\([^()]*\))\s*|\s*(?:\[[^\]]*\]|\([^()]*\))/gm, ""),
            duration: parseInt(info.videoDetails.lengthSeconds) - (createImportDto.startTime || 0),
            thumbnail_url: info.videoDetails?.thumbnails[info.videoDetails.thumbnails.length - 1]?.url,
            description: info.videoDetails.description,
            youtubeUrl: createImportDto.url,
            youtubeStart: createImportDto.startTime,
            artists: createImportDto.artists,
            albums: createImportDto.albums
        }
        importEntity.url = createImportDto.url;
        importEntity.startTime = createImportDto.startTime;
        importEntity.dstFilepath = dstFilepath;
        importEntity.dstFilename = sanitize(info.videoDetails.title + ".mp3");

        // TODO: Implement queue for downloads.
        // Enqueueing should be made before setting timeout

        setTimeout(() => {
            this.download(importEntity).then(async () => {
                const artworkBuffer = await this.artworkService.optimizeImageBuffer(await this.artworkService.downloadImageUrl(importEntity.metadata.thumbnail_url), "song");

                const tags: NodeID3.Tags = {
                    title: importEntity.metadata.title.length >= 30 ? importEntity.metadata.title.slice(0, 30) : importEntity.metadata.title,
                    image: {
                        mime: "image/jpg",
                        type: {
                            id: 3,
                            name: "front cover"
                        },
                        description: "",
                        imageBuffer: artworkBuffer
                    }
                }

                if(importEntity.metadata.albums) tags.album = importEntity.metadata.albums.join("/")
                if(importEntity.metadata.artists) tags.artist = importEntity.metadata.artists.join("/")

                // Write id3 tags
                NodeID3.write(tags, importEntity.dstFilepath, (err) => {
                    if(err){
                        importEntity.status = "errored";
                        this.logger.warn("Could not write id3 tags for import: " + importEntity.metadata.title)
                        console.error(err);
                        this.sendUpdate(importEntity)
                        return
                    }

                    setTimeout(() => {
                        // trigger indexing
                        this.indexService.createIndex(mount, importEntity.dstFilename, importer).then((index) => {
                            // TODO: Send upgrade to index to socket
                            importEntity.upgradeIndex = index
                            importEntity.status = "upgradeIndex"
                            this.sendUpdate(importEntity)
                        });
                    }, 100)
                })
            }).catch((reason) => {
                this.logger.error("Import failed for " + importEntity.metadata.title + ": ", reason)

                importEntity.status = "errored"
                this.sendUpdate(importEntity)
            });
        }, 100)

        return importEntity;
    }

    private async download(importEntity: ImportEntity): Promise<void> {
        return new Promise((resolve, reject) => {
            const tmpFilepath = this.storageService.buildTmpFilepath();

            const downloadStream = ytdl(importEntity.downloadableUrl, {
                filter: "audioonly",
                quality: "highestaudio"
            })

            downloadStream.on('progress', (chunkSize: number, transfered: number, total: number) => {
                importEntity.status = "downloading"
                importEntity.downloadProgress = (transfered/total) * 100;

                this.sendUpdate(importEntity)
            })

            // Download to tmp file
            const writeStream = downloadStream.pipe(fs.createWriteStream(tmpFilepath, { autoClose: true, flags: "w" }))

            downloadStream.on("error", (err) => {
                reject(err)
            })
            writeStream.on("error", (err) => {
                reject(err)
            })

            writeStream.on("finish", () => {
                // Convert video/webm to mp3 using ffmpeg
                exec(`${pathToFfmpeg} -i "${tmpFilepath}" -vn -ab 128k -ar 44100 -y "${importEntity.dstFilepath}"`, (error) => {
                    if(error) reject(error)
                    else resolve()
                })
            })
        })
    }

    /**
     * 
     */
    private async sendUpdate(value: ImportEntity): Promise<any> {
        // TODO: Send updates to sockets
        
    }

}