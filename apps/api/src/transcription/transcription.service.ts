import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as pathModule from 'path';
import axios from 'axios';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  private getMockTranscript(): string {
    const mocks = [
      "Customer called complaining about the unexpected charge of $50 on their credit card. They requested a full refund as they did not authorize it.",
      "नमस्ते, मेरे अकाउंट से पैसे कट गए हैं बिना किसी जानकारी के। मुझे तुरंत अपना रिफंड चाहिए। मैं बहुत परेशान हूँ।",
      "हॅलो, माझ्या खात्यातून अतिरिक्त पैसे वजा झाले आहेत. कृपया हे पैसे परत करा, नाहीतर मला तक्रार करावी लागेल।",
      "Mera bill is month bohot high aaya hai. Please check karke refund issue kijiye, otherwise I will close my connection."
    ];
    const index = Math.floor(Math.random() * mocks.length);
    return mocks[index];
  }

  async transcribeAudio(audioPath: string): Promise<string> {
    const absolutePath = pathModule.resolve(process.cwd(), audioPath);
    const exists = fs.existsSync(absolutePath);

    this.logger.log(`[Transcription] Processing audio path: ${absolutePath}`);
    this.logger.log(`[Transcription] File exists: ${exists}`);

    if (!exists) {
      throw new Error(`Audio file not found at path: ${absolutePath}`);
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    const assemblyAiKey = process.env.ASSEMBLYAI_API_KEY;

    // If no keys are provided, throw error immediately
    if (!openAiKey && !deepgramKey && !assemblyAiKey) {
      throw new Error('Transcription unavailable. AI analysis could not be completed.');
    }

    try {
      if (openAiKey) {
        this.logger.log('[Transcription] Using OpenAI Whisper API...');
        const fileBuffer = fs.readFileSync(absolutePath);
        const fileBlob = new Blob([fileBuffer], { type: 'audio/mpeg' });
        const formData = new FormData();
        formData.append('file', fileBlob, pathModule.basename(absolutePath));
        formData.append('model', 'whisper-1');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
          headers: {
            'Authorization': `Bearer ${openAiKey}`,
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000,
        });

        const text = response.data?.text || '';
        this.logger.log(`[Transcription] OpenAI Whisper response status: ${response.status}`);
        return text;
      }

      if (deepgramKey) {
        this.logger.log('[Transcription] Using Deepgram API...');
        const fileBuffer = fs.readFileSync(absolutePath);
        const response = await axios.post(
          'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
          fileBuffer,
          {
            headers: {
              'Authorization': `Token ${deepgramKey}`,
              'Content-Type': 'application/octet-stream',
            },
            timeout: 60000,
          }
        );

        const text = response.data?.results?.channels[0]?.alternatives[0]?.transcript || '';
        this.logger.log(`[Transcription] Deepgram response status: ${response.status}`);
        return text;
      }

      if (assemblyAiKey) {
        this.logger.log('[Transcription] Using AssemblyAI API...');
        const fileBuffer = fs.readFileSync(absolutePath);
        
        // 1. Upload
        const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', fileBuffer, {
          headers: {
            'authorization': assemblyAiKey,
            'content-type': 'application/octet-stream',
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000,
        });
        const uploadUrl = uploadResponse.data.upload_url;

        // 2. Start transcription
        const transcriptResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
          audio_url: uploadUrl,
        }, {
          headers: {
            'authorization': assemblyAiKey,
            'content-type': 'application/json',
          },
          timeout: 10000,
        });
        const transcriptId = transcriptResponse.data.id;

        // 3. Poll
        let status = 'queued';
        let transcriptText = '';
        const startTime = Date.now();
        const maxPollTime = 120000; // 2 minutes

        while (status === 'queued' || status === 'processing') {
          if (Date.now() - startTime > maxPollTime) {
            throw new Error('AssemblyAI transcription polling timed out.');
          }
          await new Promise((res) => setTimeout(res, 3000));
          const statusResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
            headers: {
              'authorization': assemblyAiKey,
            },
            timeout: 10000,
          });
          status = statusResponse.data.status;
          if (status === 'completed') {
            transcriptText = statusResponse.data.text;
            break;
          } else if (status === 'error') {
            throw new Error(`AssemblyAI error: ${statusResponse.data.error}`);
          }
        }

        this.logger.log('[Transcription] AssemblyAI transcription completed successfully.');
        return transcriptText;
      }

      throw new Error('No valid STT API key matched execution block.');
    } catch (error: any) {
      this.logger.error(`[Transcription] API Error: ${error.message}`);
      throw new Error('Transcription unavailable. AI analysis could not be completed.');
    }
  }
}