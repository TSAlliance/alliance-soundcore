import { DynamicModule, Module } from '@nestjs/common';
import { SoundcoreMeiliConfig } from './config/meili.config';
import { SC_MEILI_OPTIONS } from './constants';
import { SoundcoreMeiliService } from './services/soundcore-meili.service';

@Module({
  
})
export class SoundcoreMeiliModule {

  public static forRoot(options: SoundcoreMeiliConfig): DynamicModule {
    return {
      module: SoundcoreMeiliModule,
      global: true,
      providers: [
        SoundcoreMeiliService,
        {
          provide: SC_MEILI_OPTIONS,
          useValue: options
        }
      ],
      exports: [
        SoundcoreMeiliService,
        SC_MEILI_OPTIONS
      ]
    }
  }

  public static forFeature(): DynamicModule {
    return {
      module: SoundcoreMeiliModule
    }
  }

}
