import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisService } from './analysis.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RecordingScannerService {
  private readonly logger = new Logger('Scanner');
  private readonly recordingsPath = path.join(process.cwd(), 'uploads', 'recordings');
  private isScanning = false;

  private processedFiles = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly analysisService: AnalysisService,
  ) {}

  @Cron('*/30 * * * * *') // Run every 30 seconds
  async scanRecordings() {
    if (this.isScanning) {
      return;
    }
    this.isScanning = true;

    try {
      if (!fs.existsSync(this.recordingsPath)) {
        fs.mkdirSync(this.recordingsPath, { recursive: true });
      }

      const files = fs.readdirSync(this.recordingsPath);
      
      const audioFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.mp3', '.wav', '.m4a'].includes(ext) && !this.processedFiles.has(file);
      });

      if (audioFiles.length === 0) {
        return;
      }

      console.log(`[Scanner] Found ${audioFiles.length} unprocessed files`);

      let newFilesCount = 0;

      for (const file of audioFiles) {
        const audioPath = `uploads/recordings/${file}`;
        
        // Check if exists
        const existing = await this.prisma.recording.findFirst({
          where: { audioPath },
        });

        if (existing) {
          this.processedFiles.add(file);
          continue; // SKIP
        }

        newFilesCount++;
        this.processedFiles.add(file);

        // INSERT
        const newRecording = await this.prisma.recording.create({
          data: {
            agentId: `AGENT-TEST-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            audioPath,
            status: 'Pending',
          },
        });

        console.log(`[DB] Inserted recording`);

        // Trigger AI analysis automatically
        try {
          await this.analysisService.analyzeRecording(newRecording.id);
          console.log(`[AI] Analysis started`);
        } catch (error: any) {
          console.error(`Failed to start analysis for ${file}: ${error.message}`);
        }
      }

      if (newFilesCount > 0) {
        console.log(`[Scanner] ${newFilesCount} new files detected`);
      }

    } catch (error: any) {
      this.logger.error(`Scanner failed: ${error.message}`);
    } finally {
      this.isScanning = false;
    }
  }
}
