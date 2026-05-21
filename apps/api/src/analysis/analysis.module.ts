import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { RecordingScannerService } from './recording-scanner.service';
import { OllamaAnalysisService } from './ollama-analysis.service';

@Module({
  imports: [PrismaModule, AiModule, TranscriptionModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, RecordingScannerService, OllamaAnalysisService],
})
export class AnalysisModule {}