import { Injectable, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { SongService } from '../../song/song.service';
import { StorageService } from '../../storage/storage.service';

import fs from "fs"
import { StreamRepository } from '../repositories/stream.repository';
import { SSOService } from '@tsalliance/sso-nest';

@Injectable()
export class StreamService {

    constructor(
        private storageService: StorageService,
        private songService: SongService,
        private streamRepository: StreamRepository,
        private ssoService: SSOService
    ){}

    public async addToSong(songId: string, listenerId: string) {
      const stream = await this.streamRepository.findOne({ where: { songId, listenerId }});
      if(!stream) {
        this.streamRepository.save({ songId, listenerId })
        return
      }
      
      stream.streamCount++;
      this.streamRepository.save(stream)
    }

    public async findStreamableSongById(songId: string, session: string, request: Request, response: Response) {
        const listener = await this.ssoService.findUserUsingHeader("@me", `Bearer ${session}`);

        const song = await this.songService.findByIdWithIndex(songId);
        if(!song) throw new NotFoundException("Song not found.");

        const filePath = this.storageService.buildFilepath(song.index);
    
        const stat = await this.storageService.getFileStats(filePath);
        const total = stat.size;
    
        if(request.headers.range) {    
          const range = request.headers.range;
          const parts = range.replace(/bytes=/, "").split("-");
          const partialstart = parts[0];
          const partialend = parts[1];
    
          const start = parseInt(partialstart, 10);
          const end = partialend ? parseInt(partialend, 10) : total-1;
          const chunksize = (end-start)+1;
          const readStream = fs.createReadStream(filePath, {start: start, end: end});
          
          response.writeHead(206, {
              'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
              'Accept-Ranges': 'bytes', 'Content-Length': chunksize,
              'Content-Type': 'audio/mpeg'
          });
    
          readStream.pipe(response);
        } else {
          if(listener) {
            this.addToSong(songId, listener.id);
          }

          fs.createReadStream(filePath).pipe(response)
        }
    }

}
