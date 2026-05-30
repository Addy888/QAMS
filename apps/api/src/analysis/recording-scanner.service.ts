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

  private deriveAgentId(audioPath: string) {
    const fileName = path.basename(audioPath, path.extname(audioPath));
    const segments = fileName.split("_").filter(Boolean);
    const likelyAgent = segments.find((segment) =>
      /^(FCS|AGENT|EMP|USR)[A-Za-z0-9-]+$/i.test(segment.replace(/-all$/i, "")),
    );

    if (likelyAgent) {
      return likelyAgent.replace(/-all$/i, "");
    }

    return "UNASSIGNED";
  }

  @Cron('*/30 * * * * *') // Run every 30 seconds
  async scanRecordings() {
    // Skip scanning entirely in production (Vercel has no local filesystem with recordings)
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    if (this.isScanning) {
      return;
    }
    this.isScanning = true;

    try {
      if (!fs.existsSync(this.recordingsPath)) {
        try {
          fs.mkdirSync(this.recordingsPath, { recursive: true });
        } catch (mkdirErr: any) {
          this.logger.warn(`[Scanner] Cannot create recordings directory (read-only filesystem?): ${mkdirErr.message}`);
          return;
        }
      }

      let files: string[] = [];
      try {
        files = fs.readdirSync(this.recordingsPath);
      } catch (readErr: any) {
        this.logger.warn(`[Scanner] Cannot read recordings directory: ${readErr.message}`);
        return;
      }
      
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
        try {
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
              agentId: this.deriveAgentId(audioPath),
              audioPath,
              status: 'Pending',
              statusReason: 'Discovered on disk. Queued for transcription...',
            },
          });

          console.log(`[DB] Inserted recording ${newRecording.id}`);

          // Trigger AI analysis automatically
          try {
            await this.analysisService.analyzeRecording(newRecording.id);
            console.log(`[AI] Analysis started for ${newRecording.id}`);
          } catch (error: any) {
            console.error(`Failed to start analysis for ${file}: ${error.message}`);
          }
        } catch (itemErr: any) {
           console.error(`[Scanner] Error processing individual file ${file}: ${itemErr.message}`);
        }
      }

      if (newFilesCount > 0) {
        console.log(`[Scanner] ${newFilesCount} new files detected`);
      }

    } catch (error: any) {
      this.logger.error("=========================================");
      this.logger.error(`[Scanner] scanRecordings FAILED ENTIRELY`);
      this.logger.error(`[Scanner] ERROR: ${error.message}`);
      this.logger.error(`[Scanner] Full stack trace:\n${error.stack}`);
      this.logger.error("=========================================");
    } finally {
      this.isScanning = false;
    }
  }
}
