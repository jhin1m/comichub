import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ImageMirrorProcessor } from './image-mirror.processor.js';

@Module({
  imports: [BullModule.registerQueue({ name: 'mirror' })],
  providers: [ImageMirrorProcessor],
  exports: [BullModule],
})
export class MirrorModule {}
