import { Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TranscriptionService } from "../transcription/transcription.service";
import { OllamaAnalysisService } from "./ollama-analysis.service";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

@Injectable()
export class AnalysisService implements OnModuleInit {
  private readonly logger = new Logger(AnalysisService.name);

  // Queue state variables
  private queue: string[] = [];
  private activeJobs = 0;
  
  // Job start times mapping (recordingId -> start epoch in ms)
  private jobStartTimes = new Map<string, number>();
  // Job attempt tracking (recordingId -> count of attempts)
  private jobAttempts = new Map<string, number>();

  // System warning interval timer
  private staleJobInterval: any = null;

  constructor(
    private prisma: PrismaService,
    private transcriptionService: TranscriptionService,
    private ollamaAnalysisService: OllamaAnalysisService
  ) {}

  async onModuleInit() {
    this.logger.log("=========================================");
    this.logger.log("[Queue] INITIALIZING SERVICE...");
    try {
      const staleRecordings = await this.prisma.recording.findMany({
        where: {
          status: {
            in: ["Pending", "Transcribing", "Detecting Language", "Running AI Analysis", "Saving Results", "Uploading", "Retrying"]
          }
        }
      });

      if (staleRecordings.length > 0) {
        this.logger.log(`[Queue] Found ${staleRecordings.length} stale recordings. Resetting to Pending...`);
        for (const rec of staleRecordings) {
          await this.prisma.recording.update({
            where: { id: rec.id },
            data: {
              status: "Pending",
              statusReason: "Server restarted. Resetting state to Pending for retry...",
            }
          });
          if (process.env.NODE_ENV !== 'production') {
            this.enqueueJob(rec.id);
          } else {
            this.logger.log(`[Queue] Production: skipping auto-enqueue for ${rec.id}`);
          }
        }
      }

      // Start background monitor for stalled jobs (only in non-serverless environments)
      if (process.env.NODE_ENV !== 'production') {
        if (!this.staleJobInterval) {
          this.staleJobInterval = setInterval(() => this.monitorStalledJobs(), 15000);
          if (this.staleJobInterval && typeof this.staleJobInterval.unref === 'function') {
            this.staleJobInterval.unref();
          }
        }
      } else {
        this.logger.log("[Queue] Production: skipping setInterval stale-job monitor.");
      }

      this.logger.log("[Queue] AnalysisService initialized successfully.");
      this.logger.log("=========================================");
    } catch (error: any) {
      this.logger.error("=========================================");
      this.logger.error(`[Queue] ON_MODULE_INIT CRASH DETECTED`);
      this.logger.error(`[Queue] ERROR: ${error.message}`);
      this.logger.error(`[Queue] Full stack trace:\n${error.stack}`);
      this.logger.error("[Queue] GRACEFUL FALLBACK: App will boot despite failure in resetting stale jobs.");
      this.logger.error("=========================================");
      // DO NOT re-throw — let the app boot
    }
  }

  private async monitorStalledJobs() {
    const now = Date.now();
    const workerTimeout = Number(process.env.WORKER_TIMEOUT_MS) || 180000; // 3 minutes

    for (const [id, startedAt] of this.jobStartTimes.entries()) {
      if (now - startedAt > workerTimeout) {
        this.logger.error(`[Queue] Job ${id} has stalled (running for ${Math.round((now - startedAt) / 1000)}s). Forcing timeout/failure...`);
        
        // Remove from trackers
        this.jobStartTimes.delete(id);
        
        // Decrement active jobs count
        this.activeJobs = Math.max(0, this.activeJobs - 1);

        try {
          await this.prisma.recording.update({
            where: { id },
            data: {
              status: "Timeout",
              statusReason: `Analysis timed out after exceeding the ${workerTimeout / 1000}s limit.`,
            },
          });
          this.logger.log(`[Queue] Stalled recording ${id} marked as TIMEOUT.`);
        } catch (err: any) {
          this.logger.error(`Failed to update stalled job status in DB: ${err.message}`);
        }

        // Process queue again to unjam
        this.processQueue();
      }
    }
  }

  private checkSystemResources() {
    try {
      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = (usedMem / totalMem) * 100;
      if (memUsagePercent > 85) {
        this.logger.warn(`[System Warning] High memory usage detected: ${memUsagePercent.toFixed(1)}% (${Math.round(usedMem / 1024 / 1024)}MB / ${Math.round(totalMem / 1024 / 1024)}MB)`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to retrieve system memory info: ${err.message}`);
    }
  }

  async getAllRecordings() {
    return this.getAnalysisRecordings();
  }

  async createRecordingFromUpload(audioPath: string, agentId?: string) {
    const defaultAgentId = agentId || `AGENT-TEST-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const newRecording = await this.prisma.recording.create({
      data: {
        agentId: defaultAgentId,
        audioPath,
        status: 'Pending',
        statusReason: 'Call uploaded. Queued for transcription...',
      },
    });

    this.logger.log(`[Upload] Success: Saved to database as ${newRecording.id}`);

    // Trigger analysis instantly in background
    this.analyzeRecording(newRecording.id).catch((err) => {
      this.logger.error(`Failed to trigger analysis for uploaded file ${audioPath}: ${err.message}`);
    });

    return newRecording;
  }

  async getAnalysisRecordings() {
    return this.prisma.recording.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  // STEP 8 — ADD BACKGROUND WORKER (Triggered instantly in background)
  async analyzeRecording(id: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      throw new NotFoundException(`Recording with ID ${id} not found`);
    }

    // Set to Pending initially inside the queue
    await this.prisma.recording.update({
      where: { id },
      data: {
        status: "Pending", // STEP 7 — ADD PROCESSING STATES
        statusReason: "Queued for real production AI analysis...",
      },
    });

    // Enqueue the job for asynchronous background worker processing
    this.enqueueJob(id);

    // Return immediately to the frontend so it never hangs
    return {
      success: true,
      message: "Analysis job successfully queued in the background.",
    };
  }

  private enqueueJob(id: string) {
    if (!this.queue.includes(id)) {
      this.queue.push(id);
    }
    this.processQueue();
  }

  private async processQueue() {
    const maxConcurrency = Number(process.env.MAX_CONCURRENT_ANALYSIS || 1);

    this.logger.log(`[Queue] Status: pending=${this.queue.length} active=${this.activeJobs} maxConcurrency=${maxConcurrency}`);

    if (this.activeJobs >= maxConcurrency || this.queue.length === 0) {
      return;
    }

    const id = this.queue.shift();
    if (!id) return;

    this.activeJobs++;
    this.jobStartTimes.set(id, Date.now());
    this.checkSystemResources();
    
    this.executeAnalysisJob(id)
      .catch((err) => {
        this.logger.error(`Error in queue worker processing recording ${id}: ${err.message}`);
      })
      .finally(() => {
        this.jobStartTimes.delete(id);
        this.activeJobs--;
        this.processQueue(); // Loop recursion
      });
  }

  private async executeAnalysisJob(id: string) {
    try {
      console.log(`========================`);
      console.log(`PROCESSING BACKGROUND AI JOB: ${id}`);
      console.log(`========================`);

      // 1. Update status to Transcribing
      let recording = await this.prisma.recording.update({
        where: { id },
        data: {
          status: "Transcribing",
          statusReason: "Validating call recording audio file...",
        },
      });

      // Verify file exists
      const absolutePath = path.resolve(process.cwd(), recording.audioPath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Audio file not found at path: ${recording.audioPath}`);
      }

      const transcriptionStart = Date.now();
      this.logger.log(`[STT][${id}] Started transcription`);

      await this.prisma.recording.update({
        where: { id },
        data: {
          status: "Transcribing",
          statusReason: "Converting speech to text locally...",
        },
      });

      let rawTranscript = "";
      let detectedLanguage = "";
      let transcribeErrorOccurred: any = null;
      const transcribeRetryDelays = [2000, 5000, 10000];

      // Transcription Retry mechanism
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          if (attempt > 0) {
            this.logger.warn(`[STT][${id}] Retrying transcription (Attempt ${attempt}/2)...`);
            await this.prisma.recording.update({
              where: { id },
              data: {
                status: "Transcribing",
                statusReason: `Transcription delayed. Retrying (Attempt ${attempt}/2)...`,
              },
            });
            const delay = transcribeRetryDelays[attempt - 1] || 5000;
            await new Promise((res) => setTimeout(res, delay));
          }

          const transcriptionResult = await this.transcriptionService.transcribeAudio(recording.audioPath, id);
          rawTranscript = transcriptionResult.transcript;
          detectedLanguage = transcriptionResult.detectedLanguageCode || "";
          if (rawTranscript && rawTranscript.trim() !== "") {
            transcribeErrorOccurred = null;
            break;
          }
        } catch (err: any) {
          this.logger.error(`[STT][${id}] Transcription attempt ${attempt} failed: ${err.message}`);
          transcribeErrorOccurred = err;
        }
      }

      // Backend Validation: verify transcript exists, verify is not empty, verify recording processed successfully
      if (transcribeErrorOccurred || !rawTranscript || rawTranscript.trim() === "") {
        throw new Error("Transcription unavailable. AI analysis could not be completed.");
      }

      const transcriptionDuration = Date.now() - transcriptionStart;
      this.logger.log(`[STT][${id}] Transcription completed successfully in ${transcriptionDuration}ms. Length: ${rawTranscript.length}`);

      // 2. Set to Detecting Language state
      await this.prisma.recording.update({
        where: { id },
        data: {
          status: "Detecting Language",
          statusReason: "Analyzing speech language and characteristics...",
        },
      });

      // Simple language name detection from code (standard languages support)
      let resolvedLanguage = "English";
      if (detectedLanguage === "hi") resolvedLanguage = "Hindi";
      else if (detectedLanguage === "mr") resolvedLanguage = "Marathi";
      else if (detectedLanguage === "en") resolvedLanguage = "English";
      else if (detectedLanguage) resolvedLanguage = detectedLanguage;

      // 3. Set to Running AI Analysis state
      await this.prisma.recording.update({
        where: { id },
        data: {
          transcription: rawTranscript.trim(),
          language: resolvedLanguage,
          status: "Running AI Analysis",
          statusReason: "Ollama generating quality scoring and feedback...",
        },
      });

      this.logger.log(`[AI][${id}] Starting Ollama analysis with model: ${process.env.OLLAMA_MODEL || 'phi3:mini'}`);
      const aiStart = Date.now();

      // 4. Run AI Analysis via local Ollama Service
      const parsedResult = await this.ollamaAnalysisService.analyzeTranscript(rawTranscript.trim());
      const aiDuration = Date.now() - aiStart;
      this.logger.log(`[AI][${id}] Ollama analysis completed in ${aiDuration}ms`);

      // 5. Set to Saving Results state
      await this.prisma.recording.update({
        where: { id },
        data: {
          status: "Saving Results",
          statusReason: "Persisting final scores and reports to database...",
        },
      });

      const truncate = (str: any, len: number) => String(str || '').substring(0, len);

      await this.prisma.recording.update({
        where: { id },
        data: {
          sentiment: truncate(parsedResult.sentiment, 191),
          score: parsedResult.score,
          openingStatus: truncate(parsedResult.openingStatus, 191),
          tone: truncate(parsedResult.tone, 191),
          energyLevel: truncate(parsedResult.energyLevel, 191),
          activeListening: truncate(parsedResult.activeListening, 191),
          status: 'Completed', 
          statusReason: 'AI Analysis completed successfully',
          summary: truncate(parsedResult.summary, 1000),
          language: truncate(parsedResult.language || resolvedLanguage, 191),
          coachingFeedback: truncate(parsedResult.coachingFeedback, 1000),
          customerMood: truncate(parsedResult.customerMood, 191),
          resolutionQuality: truncate(parsedResult.resolutionQuality, 191),
          escalationRisk: truncate(parsedResult.escalationRisk, 191)
        } as any,
      });

      const totalDuration = Date.now() - transcriptionStart;
      this.logger.log(`[Queue][${id}] Job completed successfully in ${totalDuration}ms (STT: ${transcriptionDuration}ms, AI: ${aiDuration}ms).`);
      
      // Clear attempt count on success
      this.jobAttempts.delete(id);

    } catch (error: any) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout');
      const attempts = (this.jobAttempts.get(id) || 0) + 1;
      this.jobAttempts.set(id, attempts);
      const maxRetries = Number(process.env.MAX_RETRIES || 3);

      this.logger.error(`[Queue][${id}] Job failed (Attempt ${attempts}/${maxRetries}): ${error.message}`);

      if (attempts < maxRetries) {
        const nextAttempt = attempts + 1;
        await this.prisma.recording.update({
          where: { id },
          data: {
            status: "Retrying",
            statusReason: `Failed: ${error.message || 'Error'}. Retrying (Attempt ${nextAttempt}/${maxRetries})...`,
          },
        });
        
        // Re-enqueue after 5s delay
        setTimeout(() => {
          this.logger.log(`[Queue][${id}] Re-queuing failed job (Attempt ${nextAttempt})...`);
          this.enqueueJob(id);
        }, 5000);
      } else {
        const status = isTimeout ? 'Timeout' : 'Failed';
        const statusReason = isTimeout ? 'AI analysis timed out (Ollama exceeded 60s limit).' : error.message;
        const truncate = (str: any, len: number) => String(str || '').substring(0, len);

        try {
          await this.prisma.recording.update({
            where: { id },
            data: {
              status,
              statusReason: truncate(statusReason, 190),
            },
          });
          this.logger.log(`[Queue][${id}] Marked as ${status.toUpperCase()} permanently after ${attempts} attempts.`);
        } catch (dbError) {
          this.logger.error(`[Queue][${id}] CRITICAL: DB update failed in catch block: ${dbError}`);
        }
      }
    }
  }

  async getAnalysisById(id: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id },
    });
    if (!recording) {
      throw new NotFoundException(`Analysis record with ID ${id} not found`);
    }
    return recording;
  }

  async getFilteredAnalysis(filters?: {
    agent?: string;
    status?: string;
    timeRange?: string;
    sentiment?: string;
    scoreMin?: string | number;
    scoreMax?: string | number;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.agent) {
      where.agentId = {
        contains: filters.agent,
      };
    }

    if (filters?.status) {
      let statusVal = filters.status;
      if (statusVal.toLowerCase() === 'completed') statusVal = 'Completed';
      else if (statusVal.toLowerCase() === 'pending') statusVal = 'Pending';
      else if (statusVal.toLowerCase() === 'processing') statusVal = 'Processing';
      else if (statusVal.toLowerCase() === 'failed') statusVal = 'Failed';
      else if (statusVal.toLowerCase() === 'retrying') statusVal = 'Retrying';

      where.status = statusVal;
    }

    if (filters?.sentiment) {
      where.sentiment = {
        contains: filters.sentiment,
      };
    }

    const minScore = filters?.scoreMin ? Number(filters.scoreMin) : undefined;
    const maxScore = filters?.scoreMax ? Number(filters.scoreMax) : undefined;

    if (minScore !== undefined || maxScore !== undefined) {
      where.score = {};
      if (minScore !== undefined && !isNaN(minScore)) {
        where.score.gte = minScore;
      }
      if (maxScore !== undefined && !isNaN(maxScore)) {
        where.score.lte = maxScore;
      }
    }

    if (filters?.timeRange) {
      const now = new Date();
      let start: Date | null = null;
      let end: Date | null = null;

      if (filters.timeRange === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (filters.timeRange === "yesterday") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      } else if (filters.timeRange === "last7") {
        start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
      } else if (filters.timeRange === "last30") {
        start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
      }

      if (start) {
        where.createdAt = {
          gte: start,
          ...(end ? { lte: end } : {}),
        };
      }
    }

    if (filters?.search) {
      const searchVal = filters.search;
      where.OR = [
        { id: { contains: searchVal } },
        { agentId: { contains: searchVal } },
        { sentiment: { contains: searchVal } },
        { tone: { contains: searchVal } },
        { status: { contains: searchVal } },
        { summary: { contains: searchVal } },
        { transcription: { contains: searchVal } },
      ];
    }

    return this.prisma.recording.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getDashboardStats() {
    const total = await this.prisma.recording.count();
    const completed = await this.prisma.recording.count({
      where: { status: 'Completed' },
    });
    const pending = await this.prisma.recording.count({
      where: {
        status: {
          notIn: ['Completed', 'Failed', 'Timeout'],
        },
      },
    });

    const avgScoreResult = await this.prisma.recording.aggregate({
      _avg: {
        score: true,
      },
      where: {
        status: 'Completed',
        score: {
          not: null,
        },
      },
    });

    return {
      totalCalls: total,
      processedCalls: completed,
      pendingCalls: pending,
      avgAiScore: avgScoreResult._avg.score || 0,
    };
  }

  async reanalyzeCall(id: string) {
    const recording = await this.prisma.recording.findUnique({
      where: { id },
    });

    if (!recording) {
      throw new NotFoundException(`Recording with ID ${id} not found`);
    }

    // Reset previous metrics and set to Pending
    await this.prisma.recording.update({
      where: { id },
      data: {
        status: "Pending",
        statusReason: "Re-queued for fresh AI analysis...",
        sentiment: null,
        score: null,
        openingStatus: null,
        openingDelay: null,
        openingScore: null,
        openingFeedback: null,
        tone: null,
        energyLevel: null,
        activeListening: null,
        summary: null,
      },
    });

    // Enqueue
    this.enqueueJob(id);

    // Fetch and return updated record
    const updated = await this.prisma.recording.findUnique({
      where: { id },
    });

    return {
      success: true,
      message: "Reanalysis job successfully queued.",
      analysis: updated,
    };
  }

  async syncData() {
    // Re-fetch all pending or failed recordings
    const pendingOrFailed = await this.prisma.recording.findMany({
      where: {
        status: {
          in: ["Pending", "Failed"],
        },
      },
    });

    const processSingleCallOnly = process.env.PROCESS_SINGLE_CALL_ONLY === "true";
    let recordsToEnqueue = pendingOrFailed;

    if (processSingleCallOnly && pendingOrFailed.length > 0) {
      this.logger.warn(`[Queue] PROCESS_SINGLE_CALL_ONLY is enabled. Enqueuing only the first recording out of ${pendingOrFailed.length} pending/failed ones.`);
      recordsToEnqueue = [pendingOrFailed[0]];
    }

    // Enqueue each
    for (const rec of recordsToEnqueue) {
      this.enqueueJob(rec.id);
    }

    return {
      success: true,
      message: `Data sync complete. Enqueued ${recordsToEnqueue.length} recordings for AI analysis.`,
      count: recordsToEnqueue.length,
    };
  }

  generateCSV(records: any[]): string {
    const headers = [
      "Record ID",
      "Agent Name",
      "Sentiment",
      "Score",
      "Tone",
      "Energy Level",
      "Active Listening",
      "AI Summary",
      "Status",
      "Status Reason",
      "Created At"
    ];

    const escape = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = records.map(r => [
      escape(r.id),
      escape(r.agentId),
      escape(r.sentiment),
      escape(r.score !== null ? `${r.score}%` : "—"),
      escape(r.tone),
      escape(r.energyLevel),
      escape(r.activeListening),
      escape(r.summary),
      escape(r.status),
      escape(r.statusReason),
      escape(r.createdAt ? new Date(r.createdAt).toISOString() : "")
    ]);

    return [headers.join(","), ...rows.map(row => row.join(","))].join("\r\n");
  }

  async generateExcel(records: any[]): Promise<any> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('QAMS Analysis');

    worksheet.columns = [
      { header: 'Record ID', key: 'id', width: 38 },
      { header: 'Agent Name', key: 'agentId', width: 15 },
      { header: 'Sentiment', key: 'sentiment', width: 15 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Opening Status', key: 'openingStatus', width: 25 },
      { header: 'Tone', key: 'tone', width: 20 },
      { header: 'Energy Level', key: 'energyLevel', width: 15 },
      { header: 'Active Listening', key: 'activeListening', width: 20 },
      { header: 'AI Summary', key: 'summary', width: 50 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 22 }
    ];

    // 3. FORMAT HEADERS (Dark background, white text, bold, centered)
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell: any) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' } // dark gray
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 25;

    // 2. ADD ROWS PROPERLY
    records.forEach(r => {
      worksheet.addRow({
        id: r.id,
        agentId: r.agentId,
        sentiment: r.sentiment,
        score: r.score !== null ? `${r.score}%` : "—",
        openingStatus: r.openingStatus,
        tone: r.tone,
        energyLevel: r.energyLevel,
        activeListening: r.activeListening,
        summary: r.summary,
        status: r.status,
        createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString() : ""
      });
    });

    // 5. TEXT WRAPPING
    ['openingStatus', 'tone', 'summary'].forEach(colKey => {
      const col = worksheet.getColumn(colKey);
      col.alignment = { wrapText: true, vertical: 'top' };
    });
    
    // Top align all data rows for clean read
    worksheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber > 1) {
        row.alignment = { wrapText: true, vertical: 'top' };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  async generatePDF(records: any[], res: any) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Stream PDF directly to response
    doc.pipe(res);

    // Title / Header
    doc.fillColor('#1E3A8A').fontSize(24).text('QAMS AI ANALYSIS REPORT', { align: 'center' });
    doc.fillColor('#4B5563').fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown(1);

    // Draw horizontal line
    doc.strokeColor('#E5E7EB').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1.5);

    // Loop through recordings and display beautifully
    records.forEach((record, index) => {
      if (doc.y > 680) {
        doc.addPage();
      }

      doc.fillColor('#1E3A8A').fontSize(12).text(`Call #${index + 1}: ${record.id}`, { bold: true });
      doc.moveDown(0.2);

      // Metadata Grid
      const yStart = doc.y;
      doc.fillColor('#374151').fontSize(9);
      doc.text(`Agent ID: ${record.agentId || '—'}`, 50, yStart);
      doc.text(`AI Score: ${record.score !== null ? record.score + '%' : '—'}`, 200, yStart);
      doc.text(`Sentiment: ${record.sentiment || '—'}`, 350, yStart);
      doc.text(`Date: ${record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '—'}`, 480, yStart);

      doc.moveDown(0.5);
      const ySecond = doc.y;
      doc.text(`Tone: ${record.tone || '—'}`, 50, ySecond);
      doc.text(`Energy Level: ${record.energyLevel || '—'}`, 200, ySecond);
      doc.text(`Active Listening: ${record.activeListening || '—'}`, 350, ySecond);
      doc.text(`Status: ${record.status || '—'}`, 480, ySecond);

      doc.moveDown(0.8);

      if (record.summary) {
        doc.fillColor('#4B5563').fontSize(9).text('AI Summary:', 50);
        doc.fillColor('#1F2937').fontSize(8.5).text(record.summary, 60, doc.y, { width: 480, align: 'justify' });
        doc.moveDown(0.8);
      }

      // Add a subtle border or line between items
      doc.strokeColor('#F3F4F6').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1.5);
    });

    doc.end();
  }
}