import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ArtworkService } from './artwork.service';

@Controller('artworks')
export class ArtworkController {
  constructor(private readonly artworkService: ArtworkService) {}

  @Get(":artworkId")
  public async streamArtworkById(@Param("artworkId") artworkId: string, @Res() response: Response): Promise<void> {
    const stream = await this.artworkService.streamById(artworkId);
    stream.pipe(response)
    /*return new StreamableFile(await this.artworkService.streamById(artworkId), {
      type: "image/jpeg"
    })*/
  }
}
