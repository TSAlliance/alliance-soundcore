import { Controller } from '@nestjs/common';
import { ArtworkService } from './artwork.service';

@Controller('artwork')
export class ArtworkController {
  constructor(private readonly artworkService: ArtworkService) {}
}
