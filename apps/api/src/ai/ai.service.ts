import { Injectable, Logger } from '@nestjs/common';

export interface RealAnalysisResult {
  sentiment: string;
  score: number;
  openingStatus: string;
  tone: string;
  energyLevel: string;
  activeListening: string;
  aiSummary: string;
  recommendations: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async analyzeTranscript(transcript: string): Promise<RealAnalysisResult> {
    this.logger.log('[AI] Running high-performance mock AI analysis on transcript...');

    // Wait 1 second to simulate realistic thinking time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const sentiments = ['Positive', 'Neutral', 'Negative'];
    const openingStatuses = ['Good Opening', 'Average', 'Poor Opening'];
    const tones = ['Professional', 'Friendly', 'Rude'];
    const energyLevels = ['High', 'Medium', 'Low'];
    const activeListeningValues = ['Strong', 'Average', 'Poor'];

    // Select random but professional metrics
    const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    const score = Math.floor(Math.random() * 25) + 75; // Scores between 75 and 100
    const openingStatus = openingStatuses[Math.floor(Math.random() * openingStatuses.length)];
    const tone = tones[Math.floor(Math.random() * tones.length)];
    const energyLevel = energyLevels[Math.floor(Math.random() * energyLevels.length)];
    const activeListening = activeListeningValues[Math.floor(Math.random() * activeListeningValues.length)];

    const aiSummary = 'The agent initiated the call with a professional greeting, verified the customer\'s order details, and resolved the issue promptly. The customer expressed satisfaction with the resolution.';
    
    const recommendations = 'Continue maintaining the warm tone and active listening. Ensure prompt transition when transferring calls or looking up database information.';

    return {
      sentiment,
      score,
      openingStatus,
      tone,
      energyLevel,
      activeListening,
      aiSummary,
      recommendations,
    };
  }
}
