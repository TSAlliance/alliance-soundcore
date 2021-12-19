import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { createHash } from "crypto";
import ffprobe from "ffprobe"
import ffprobeStatic from "ffprobe-static"
import NodeID3 from 'node-id3';
import { createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, unlinkSync } from "fs";
import { join } from "path";
import { Readable } from "stream";
import { SongMetadataDTO } from "../song/dto/song-metadata.dto";
import { Artist } from "../artist/entities/artist.entity";
import sharp from "sharp";

export const UPLOAD_TMP_DIR = join(process.cwd(), "tmp-data");
export const UPLOAD_ROOT_DIR = join(process.cwd(), "uploaded-data");
export const UPLOAD_SONGS_DIR = join(UPLOAD_ROOT_DIR, "songs");

@Injectable()
export class StorageService {
    private logger: Logger = new Logger(StorageService.name)

    constructor(){
        this.delete(UPLOAD_TMP_DIR).then(() => {
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
    public async delete(filepath: string): Promise<void> {
        if(!filepath || !existsSync(filepath)) return;

        const stats = lstatSync(filepath, { throwIfNoEntry: false })
        if(!stats) return;

        if(stats.isDirectory()) {
            rmSync(filepath, { recursive: true })
        } else {
            unlinkSync(filepath);
        }
    }

    /**
     * Read metadata of audio files.
     * @param filepath 
     * @returns 
     */
    public async readMetadataFromAudioFile(filepath: string): Promise<SongMetadataDTO> {
        const id3Tags = NodeID3.read(readFileSync(filepath));

        // Get duration in seconds
        const probe = await ffprobe(filepath, { path: ffprobeStatic.path })
        const durationInSeconds = Math.round(probe.streams[0].duration || 0);

        // Get artists
        const artists = id3Tags.artist.split("/")
        for(const index in artists) {
            artists.push(...artists[index].split(","))
            artists.splice(parseInt(index), 1)
        }

        // Get artwork buffer
        const artworkBuffer: Buffer = id3Tags.image["imageBuffer"];
    
        return {
            title: id3Tags.title,
            artists: artists.map((name) => ({ name }) as Artist),
            durationInSeconds,
            artworkBuffer: sharp(artworkBuffer).jpeg({ quality: 90 }).toBuffer()
        }
    }

}