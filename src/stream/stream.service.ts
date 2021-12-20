import { Injectable, NotFoundException } from '@nestjs/common';
import { Response, Request } from 'express';
import { createReadStream, statSync } from 'fs';
import { SongService } from '../song/song.service';
import { UploadService } from '../upload/services/upload.service';

@Injectable()
export class StreamService {

    constructor(
        private uploadService: UploadService,
        private songService: SongService
    ) {}

    public async findStreamableSongById(songId: string, request: Request, response: Response) {
        const song = await this.songService.findByIdWithRelations(songId);
        if(!song) throw new NotFoundException("Song not found.");

        const filePath = "" // await this.uploadService.findPathById(song.file.id);
    
        const stat = statSync(filePath);
        const total = stat.size;
    
        if(request.headers.range) {    
          const range = request.headers.range;
          const parts = range.replace(/bytes=/, "").split("-");
          const partialstart = parts[0];
          const partialend = parts[1];
    
          const start = parseInt(partialstart, 10);
          const end = partialend ? parseInt(partialend, 10) : total-1;
          const chunksize = (end-start)+1;
          const readStream = createReadStream(filePath, {start: start, end: end});
          
          response.writeHead(206, {
              'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
              'Accept-Ranges': 'bytes', 'Content-Length': chunksize,
              'Content-Type': 'audio/mpeg'
          });
    
          readStream.pipe(response);
        } else {
          createReadStream(filePath).pipe(response)
        }
    }



}
