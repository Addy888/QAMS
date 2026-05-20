import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TranscriptionService } from "../transcription/transcription.service";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  // STEP 1 — CREATE AI JOB QUEUE
  private queue: string[] = [];
  private activeJobs = 0;
  private readonly maxConcurrency = 3; // STEP 2 — LIMIT CONCURRENT AI REQUESTS

  constructor(
    private prisma: PrismaService,
    private transcriptionService: TranscriptionService,
  ) {}

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
    if (this.activeJobs >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const id = this.queue.shift();
    if (!id) return;

    this.activeJobs++;
    
    this.executeAnalysisJob(id)
      .catch((err) => {
        this.logger.error(`Error in queue worker processing recording ${id}: ${err.message}`);
      })
      .finally(() => {
        this.activeJobs--;
        this.processQueue(); // Loop recursion
      });
  }

  private async executeAnalysisJob(id: string) {
    try {
      console.log(`========================`);
      console.log(`PROCESSING BACKGROUND AI JOB: ${id}`);
      console.log(`========================`);

      // 1. Update status to Processing Audio
      let recording = await this.prisma.recording.update({
        where: { id },
        data: {
          status: "Processing Audio",
          statusReason: "Validating call recording audio file...",
        },
      });

      // Verify file exists
      const absolutePath = path.resolve(process.cwd(), recording.audioPath);
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Audio file not found at path: ${recording.audioPath}`);
      }

      this.logger.log(`[STT] Started transcription for recording ${id}`);

      // 2. Update status to Generating Transcript
      await this.prisma.recording.update({
        where: { id },
        data: {
          status: "Generating Transcript",
          statusReason: "Converting speech to text...",
        },
      });

      let rawTranscript = "";
      let transcribeErrorOccurred: any = null;
      const transcribeRetryDelays = [2000, 5000, 10000];

      // Transcription Retry mechanism
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          if (attempt > 0) {
            this.logger.warn(`[STT] Retrying transcription for recording ${id} (Attempt ${attempt}/2)...`);
            await this.prisma.recording.update({
              where: { id },
              data: {
                status: "Generating Transcript",
                statusReason: `Transcription delayed. Retrying (Attempt ${attempt}/2)...`,
              },
            });
            const delay = transcribeRetryDelays[attempt - 1] || 5000;
            await new Promise((res) => setTimeout(res, delay));
          }

          rawTranscript = await this.transcriptionService.transcribeAudio(recording.audioPath);
          if (rawTranscript && rawTranscript.trim() !== "") {
            transcribeErrorOccurred = null;
            break;
          }
        } catch (err: any) {
          this.logger.error(`[STT] Transcription attempt ${attempt} failed: ${err.message}`);
          transcribeErrorOccurred = err;
        }
      }

      // Backend Validation: verify transcript exists, verify is not empty, verify recording processed successfully
      if (transcribeErrorOccurred || !rawTranscript || rawTranscript.trim() === "") {
        throw new Error("Transcription unavailable. AI analysis could not be completed.");
      }

      this.logger.log(`[STT] Transcription completed successfully. Length: ${rawTranscript.length}`);

      // 3. Save transcript and update status to Running AI Analysis
      await this.prisma.recording.update({
        where: { id },
        data: {
          transcription: rawTranscript.trim(),
          status: "Running AI Analysis",
          statusReason: "AI is generating call quality insights...",
        },
      });

      console.log("SAVED TRANSCRIPT TO DATABASE:", rawTranscript.substring(0, 100) + "...");

      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'phi3';

      // 1. Language Detection
      let detectedLanguage = "English";
      try {
        console.log(`[Language Detection] Detecting language...`);
        const langPrompt = `Identify the language of this Indian customer support call transcript. Choose the single most dominant language from: English, Hindi, Marathi, Hinglish. Return ONLY the single language name (e.g. English, Hindi, Marathi, Hinglish) without any other words or punctuation.

Transcript:
${rawTranscript.trim()}`;

        const langResponse = await axios.post(
          `${ollamaUrl}/api/generate`,
          {
            model: ollamaModel,
            prompt: langPrompt,
            stream: false,
            options: {
              temperature: 0.1,
              num_predict: 10
            }
          },
          { timeout: 30000 }
        );

        const langText = langResponse.data?.response?.trim() || "English";
        console.log(`[Language Detection] Raw output: ${langText}`);
        if (langText.toLowerCase().includes("hindi")) detectedLanguage = "Hindi";
        else if (langText.toLowerCase().includes("marathi")) detectedLanguage = "Marathi";
        else if (langText.toLowerCase().includes("hinglish")) detectedLanguage = "Hinglish";
        else detectedLanguage = "English";
      } catch (err: any) {
        console.error(`[Language Detection] Failed, defaulting to English:`, err.message);
        detectedLanguage = "English";
      }
      this.logger.log(`[Language Detection] Detected Language: ${detectedLanguage}`);

      const prompt = `
You are an enterprise AI QA analyst for Indian customer support calls.

You are analyzing Indian customer support conversations that may contain Hindi, Marathi, Hinglish, or mixed-language speech. Evaluate naturally and do not penalize regional languages. Do not mark calls as "frustrated" only because of Hindi words, loud speech, or regional language usage.

Analyze the following transcript:
Dominant Language: ${detectedLanguage}
Transcript:
${rawTranscript.trim()}

Evaluate and score the call based on these five categories (0-100 scale):
1. Tone Stability (weight: 15%): Professional, polite, calm, and steady tone.
2. Active Listening (weight: 20%): Empathy, understanding customer concern, not interrupting.
3. Resolution Quality (weight: 25%): Effectively addressing customer concern, providing correct information.
4. Professionalism (weight: 15%): Proper greeting, adhering to call etiquette, confidence.
5. Customer Satisfaction (weight: 25%): Respectfulness, emotional control, and resolution acceptance.

Also provide:
- sentiment: Customer sentiment (e.g. Positive, Neutral, Negative, Frustrated)
- sentimentConfidence: Confidence score of sentiment (0 to 100)
- isGenuinelyBad: set to true ONLY if the call quality is truly terrible (e.g. agent rude, zero help, customer hung up in anger), otherwise false.
- summary: A concise summary of the conversation.
- statusReason: A brief reason for the final score.
- openingStatus: A brief description of how the agent opened the call.
- tone: A brief description of the agent's tone.
- energyLevel: A brief description of the agent's energy level.
- activeListening: A brief description of the agent's active listening skills.

Return ONLY a valid JSON object matching this schema. Do not include any markdown styling, quotes outside JSON, or extra text.

{
  "toneScore": 0,
  "listeningScore": 0,
  "resolutionScore": 0,
  "professionalismScore": 0,
  "satisfactionScore": 0,
  "sentiment": "",
  "sentimentConfidence": 0,
  "isGenuinelyBad": false,
  "summary": "",
  "statusReason": "",
  "openingStatus": "",
  "tone": "",
  "energyLevel": "",
  "activeListening": ""
}
`;

      let response: any = null;
      let errorOccurred: any = null;
      const retryDelays = [2000, 5000, 10000];

      // RETRY PIPELINE
      for (let attempt = 0; attempt <= 3; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`RETRYING AI GENERATION FOR RECORDING ${id} (ATTEMPT ${attempt}/3)...`);
            
            await this.prisma.recording.update({
              where: { id },
              data: {
                status: "Retrying",
                statusReason: `Ollama call failed. Retrying (Attempt ${attempt}/3)...`,
              },
            });

            // Wait progressive delay time
            const delay = retryDelays[attempt - 1] || 10000;
            await new Promise((res) => setTimeout(res, delay));
          }

          console.log(`CALLING OLLAMA AI ENGINE...`);
          response = await axios.post(
            `${ollamaUrl}/api/generate`,
            {
              model: ollamaModel,
              prompt,
              stream: false,
              format: 'json',
              options: {
                temperature: 0.9,
                top_p: 0.95,
                num_predict: 800
              }
            },
            {
              timeout: 180000,
            }
          );

          if (response) {
            errorOccurred = null;
            break;
          }
        } catch (err: any) {
          console.log(`OLLAMA CALL ATTEMPT ${attempt} FAILED:`, err.message);
          errorOccurred = err;
        }
      }

      if (errorOccurred) {
        throw errorOccurred;
      }

      console.log('STEP 4 RAW RESPONSE');
      const raw = response?.data?.response
        ?.replace(/```json/g, '')
        ?.replace(/```/g, '')
        ?.trim() || '';
      console.log(raw);

      if (!raw) {
        throw new Error("Empty response from Ollama");
      }

      console.log('STEP 5 JSON PARSE');
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in Ollama response");
      }
      const parsedResult = JSON.parse(jsonMatch[0]);

      // Calculate weighted score
      const toneScore = Number(parsedResult.toneScore) || 70;
      const listeningScore = Number(parsedResult.listeningScore) || 70;
      const resolutionScore = Number(parsedResult.resolutionScore) || 70;
      const professionalismScore = Number(parsedResult.professionalismScore) || 70;
      const satisfactionScore = Number(parsedResult.satisfactionScore) || 70;

      let calculatedScore = Math.round(
        (toneScore * 0.15) +
        (listeningScore * 0.20) +
        (resolutionScore * 0.25) +
        (professionalismScore * 0.15) +
        (satisfactionScore * 0.25)
      );

      // Clamping and fallbacks
      const isGenuinelyBad = !!parsedResult.isGenuinelyBad;
      if (calculatedScore < 60 && !isGenuinelyBad) {
        calculatedScore = 60; // Fallback Minimum Score: minimum should be 60 unless call is truly terrible
      }

      // Never default to 0 unless analysis completely fails
      if (calculatedScore <= 0) {
        calculatedScore = 60;
      }

      // Log Debug AI Output
      console.log("==================================================");
      console.log("[DEBUG AI Output]");
      console.log(`- Transcript Language: ${detectedLanguage}`);
      console.log(`- Raw AI Response: ${raw}`);
      console.log(`- Scoring Breakdown:`);
      console.log(`  * Tone Score: ${toneScore} (15%)`);
      console.log(`  * Active Listening Score: ${listeningScore} (20%)`);
      console.log(`  * Resolution Quality Score: ${resolutionScore} (25%)`);
      console.log(`  * Professionalism Score: ${professionalismScore} (15%)`);
      console.log(`  * Customer Satisfaction Score: ${satisfactionScore} (25%)`);
      console.log(`  * Calculated Weighted Score: ${calculatedScore}`);
      console.log(`  * Is Genuinely Bad: ${isGenuinelyBad}`);
      console.log(`- Sentiment Confidence: ${parsedResult.sentimentConfidence || 100}%`);
      console.log("==================================================");

      console.log('STEP 6 UPDATE DATABASE (SAVING RESULTS IMMEDIATELY)');
      const truncate = (str: any, len: number) => String(str || '').substring(0, len);

      await this.prisma.recording.update({
        where: { id },
        data: {
          sentiment: truncate(parsedResult.sentiment, 191),
          score: calculatedScore,
          openingStatus: truncate(parsedResult.openingStatus, 191),
          tone: truncate(parsedResult.tone, 191),
          energyLevel: truncate(parsedResult.energyLevel, 191),
          activeListening: truncate(parsedResult.activeListening, 191),
          status: 'Completed', 
          statusReason: parsedResult.statusReason ? truncate(parsedResult.statusReason, 191) : 'AI Analysis completed successfully',
          summary: truncate(parsedResult.summary, 1000),
          language: detectedLanguage,
        },
      });

      console.log(`[Ollama] AI analysis completed`);
      console.log(`JOB ${id} COMPLETED SUCCESSFULLY!`);

    } catch (error: any) {
      console.log('REAL AI ANALYSIS FAILED — NO MANUAL FALLBACKS ALLOWED');
      console.log(error);

      const truncate = (str: any, len: number) => String(str || '').substring(0, len);

      try {
        await this.prisma.recording.update({
          where: { id },
          data: {
            status: 'Failed',
            statusReason: truncate(`${error.message || 'Unknown error'}`, 190),
          },
        });
        console.log(`RECORDING ${id} MARKED AS FAILED.`);
      } catch (dbError) {
        console.error('CRITICAL: DB update failed in error catch block:', dbError);
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

    // Enqueue each
    for (const rec of pendingOrFailed) {
      this.enqueueJob(rec.id);
    }

    return {
      success: true,
      message: `Data sync complete. Enqueued ${pendingOrFailed.length} recordings for AI analysis.`,
      count: pendingOrFailed.length,
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