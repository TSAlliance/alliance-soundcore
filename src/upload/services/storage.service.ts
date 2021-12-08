import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createHash } from "crypto";
import * as ffprobe from "ffprobe"
import * as ffprobeStatic from "ffprobe-static"
import * as NodeID3 from 'node-id3';
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync } from "fs";
import { join } from "path";
import { Readable } from "stream";
import { SongMetadataDTO } from "../../song/dto/song-metadata.dto";
import { UploadedFileRepository } from "../repositories/uploaded-file.repository";

export const UPLOAD_TMP_DIR = join(process.cwd(), "tmp-data");
export const UPLOAD_ROOT_DIR = join(process.cwd(), "uploaded-data");
export const UPLOAD_SONGS_DIR = join(UPLOAD_ROOT_DIR, "songs");

@Injectable()
export class StorageService {

    constructor(private uploadRepository: UploadedFileRepository){
        this.deleteDirectory(UPLOAD_TMP_DIR).then(() => {
            if(!existsSync(UPLOAD_ROOT_DIR)) mkdirSync(UPLOAD_ROOT_DIR, { recursive: true });
            if(!existsSync(UPLOAD_TMP_DIR)) mkdirSync(UPLOAD_TMP_DIR, { recursive: true });
            if(!existsSync(UPLOAD_SONGS_DIR)) mkdirSync(UPLOAD_SONGS_DIR, { recursive: true });
        })
    }

    /**
     * Calculte checksum from file contents.
     * @param filepath Path to file
     * @returns String
     */
    public async generateChecksumOfFile(filepath: string | Buffer): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = createHash('md5');
            let stream;

            if(Buffer.isBuffer(filepath)) {
                stream = Readable.from(filepath.toString())
            } else {
                stream = Readable.from(createReadStream(filepath))
            }

            stream.on('error', reject);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('close', () => resolve(hash.digest('hex')));
        })
    }

    /**
     * Check if an uploaded audio file has supported file format.
     * @param file Express Multer File
     * @returns True or False
     */
    public async hasSupportedAudioFormat(filepath: string): Promise<boolean> {
        const metadata = await ffprobe(filepath, { path: ffprobeStatic.path }).catch((error) => { 
            console.error(error); 
            return null 
        });

        if(!metadata) throw new InternalServerErrorException("Could not read file.")

        const mimetype = metadata.streams[0].codec_type + "/" + metadata.streams[0].codec_name;
        const supportedFormats = ["audio/mpeg", "audio/mp4", "audio/mp3", "audio/ogg", "audio/vorbis", "audio/aac", "audio/opus", "audio/wav", "audio/webm", "audio/flac", "audio/x-flac"];
        
        return supportedFormats.includes(mimetype.toLowerCase());
    }

    /**
     * Delete file from filesystem
     * @param filepath Path to delete.
     */
    public async deleteFile(filepath: string): Promise<void> {
        if(!existsSync(filepath)) return;
        unlinkSync(filepath);
    }

    /**
     * Clear directory on filesystem
     * @param filepath Path to clear
     */
     public async deleteDirectory(dir: string): Promise<void> {
        if(!existsSync(dir)) return;
        rmSync(dir, { recursive: true })
    }

    /**
     * Check if there already is an entry in database with exact same checksum.
     * If true, there might be a duplicate file upload.
     * @param checksum 
     * @returns 
     */
    public async existsFileByChecksum(checksum: string): Promise<boolean> {
        return !!(await this.uploadRepository.findOne({ where: { checksum }}));
    }

    /**
         * Read metadata of audio files.
         * @param filepath 
         * @returns 
         */
    public async readMetadataFromAudioFile(filepath: string): Promise<SongMetadataDTO> {
        const id3Tags = NodeID3.read(readFileSync(filepath));

        const probe = await ffprobe(filepath, { path: ffprobeStatic.path })
        const durationInSeconds = Math.round(probe.streams[0].duration || 0);

        return {
            title: id3Tags.title,
            durationInSeconds
        }
    }

}