import { Test, TestingModule } from '@nestjs/testing';
import { SoundcoreMeiliSyncController } from './soundcore-meili-sync.controller';
import { SoundcoreMeiliSyncService } from './soundcore-meili-sync.service';

describe('SoundcoreMeiliSyncController', () => {
  let soundcoreMeiliSyncController: SoundcoreMeiliSyncController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SoundcoreMeiliSyncController],
      providers: [SoundcoreMeiliSyncService],
    }).compile();

    soundcoreMeiliSyncController = app.get<SoundcoreMeiliSyncController>(SoundcoreMeiliSyncController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(soundcoreMeiliSyncController.getHello()).toBe('Hello World!');
    });
  });
});
