import { Controller, Get, Post, Param, Query, Res, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
  ) {}

  @Get('health/diagnostic')
  async getDiagnostic() {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      environment: {
        OLLAMA_URL: process.env.OLLAMA_URL || 'NOT SET',
        OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'NOT SET',
      },
      uploadPath: {
        relative: 'uploads/recordings',
        absolute: path.join(process.cwd(), 'uploads', 'recordings'),
        exists: fs.existsSync(path.join(process.cwd(), 'uploads', 'recordings')),
      },
      recordingFiles: [] as string[],
      requiredConfiguration: [
        'Set up Ollama at http://localhost:11434 (check if running)',
      ],
    };

    try {
      const recordingsDir = path.join(process.cwd(), 'uploads', 'recordings');
      if (fs.existsSync(recordingsDir)) {
        const files = fs.readdirSync(recordingsDir);
        diagnostics.recordingFiles = files.slice(0, 10); // Show first 10
      }
    } catch (err: any) {
      diagnostics.recordingFiles = [`Error reading directory: ${err.message}`];
    }

    return diagnostics;
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'recordings');
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `file-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.mp3', '.wav', '.m4a'].includes(ext)) {
          return cb(new Error('Unsupported audio format. Only MP3, WAV, and M4A are supported.'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new Error('No file uploaded or file format is invalid.');
    }
    const audioPath = `uploads/recordings/${file.filename}`;
    const newRecording = await this.analysisService.createRecordingFromUpload(audioPath);
    return {
      success: true,
      recording: newRecording,
    };
  }

  @Get()
  async getAnalysis(@Query() query: any) {
    const records = await this.analysisService.getFilteredAnalysis(query);
    return {
      success: true,
      data: records,
    };
  }

  @Get('recordings')
  async getAnalysisRecordings(@Query() query: any) {
    console.log("API HIT: Fetching recordings with query:", query);
    const records = await this.analysisService.getFilteredAnalysis(query);
    console.log("RETURNING RECORDS:", records.length);
    return {
       success: true,
       data: records,
    };
  }

  @Get('export')
  async exportReport(@Query() query: any, @Res() res: any) {
    try {
      const format = (query.format || 'csv').toLowerCase();
      const records = await this.analysisService.getFilteredAnalysis(query);

      if (format === 'csv') {
        const csv = this.analysisService.generateCSV(records);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="qams_analysis_report.csv"');
        return res.status(HttpStatus.OK).send(csv);
      } else if (format === 'excel') {
        const buffer = await this.analysisService.generateExcel(records);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="qams_analysis_report.xlsx"');
        return res.status(HttpStatus.OK).send(buffer);
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="qams_analysis_report.pdf"');
        return this.analysisService.generatePDF(records, res);
      } else {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: 'Unsupported export format. Use csv, excel, or pdf.',
        });
      }
    } catch (error: any) {
      console.error("Export failed:", error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error?.message || 'Export failed',
      });
    }
  }

  @Get(':id')
  async getAnalysisById(@Param('id') id: string) {
    const record = await this.analysisService.getAnalysisById(id);
    return {
      success: true,
      data: record,
    };
  }

  @Post('analyze/:id')
  async analyze(@Param('id') id: string) {
    console.log('========================');
    console.log('ANALYZE API HIT');
    console.log('RECORDING ID:', id);
    console.log('========================');

    try {
      const result = await this.analysisService.analyzeRecording(id);
      console.log('ANALYSIS QUEUED SUCCESS');
      return result;
    } catch (error: any) {
      console.error('ANALYSIS ERROR:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error',
      };
    }
  }

  @Post('reanalyze/:id')
  async reanalyze(@Param('id') id: string) {
    console.log('========================');
    console.log('REANALYZE API HIT');
    console.log('RECORDING ID:', id);
    console.log('========================');

    try {
      const result = await this.analysisService.reanalyzeCall(id);
      console.log('REANALYSIS QUEUED SUCCESS');
      return result;
    } catch (error: any) {
      console.error('REANALYSIS ERROR:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error',
      };
    }
  }

  @Post('sync')
  async sync() {
    console.log('========================');
    console.log('SYNC API HIT');
    console.log('========================');

    try {
      const result = await this.analysisService.syncData();
      return result;
    } catch (error: any) {
      console.error('SYNC ERROR:', error);
      return {
        success: false,
        error: error?.message || 'Sync failed',
      };
    }
  }
}