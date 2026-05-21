import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

export interface AIAnalysisResult {
  language: string;
  sentiment: string;
  score: number;
  openingStatus: string;
  tone: string;
  energyLevel: string;
  activeListening: string;
  summary: string;
  coachingFeedback: string;
}

@Injectable()
export class OllamaAnalysisService {
  private readonly logger = new Logger(OllamaAnalysisService.name);

  async analyzeTranscript(transcript: string): Promise<AIAnalysisResult> {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const ollamaModel = process.env.OLLAMA_MODEL || "llama3";
    const ollamaTimeout = Number(process.env.OLLAMA_TIMEOUT_MS) || 60000;

    const prompt = `You are analyzing real Indian customer support conversations.
The conversation may contain Hindi, Marathi, Hinglish, or mixed-language speech.
Evaluate naturally and do not penalize regional languages.

Return ONLY valid JSON matching this exact structure:
{
  "language": "Hindi",
  "sentiment": "Positive",
  "score": 78,
  "openingStatus": "Professional",
  "tone": "Friendly",
  "energyLevel": "Calm",
  "activeListening": "Good",
  "summary": "Customer issue handled professionally.",
  "coachingFeedback": "Improve response speed slightly."
}

Transcript:
${transcript}`;

    const startTime = Date.now();
    try {
      this.logger.log(`Calling Ollama API at ${ollamaUrl} with model ${ollamaModel} (timeout: ${ollamaTimeout}ms)...`);
      const response = await axios.post(
        `${ollamaUrl}/api/generate`,
        {
          model: ollamaModel,
          prompt,
          stream: false,
          format: "json", // Enforce JSON
          options: {
            temperature: 0.1, // Keep it deterministic
            num_predict: 800,
          },
        },
        { timeout: ollamaTimeout }
      );

      const durationMs = Date.now() - startTime;
      this.logger.log(`Ollama API response received in ${durationMs}ms`);

      const raw = response.data?.response || "";
      return this.parseJSONSafely(raw, transcript);
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      if (error.code === "ECONNABORTED" || error.message?.toLowerCase().includes("timeout")) {
        this.logger.error(`Ollama API request timed out after ${durationMs}ms`);
        throw new Error(`Ollama API request timed out after ${ollamaTimeout}ms.`);
      }
      this.logger.error(`Ollama Analysis failed after ${durationMs}ms: ${error.message}`);
      throw error;
    }
  }

  private parseJSONSafely(raw: string, transcript: string): AIAnalysisResult {
    let cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // Attempt to extract json block if there's surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(cleaned);
      
      return {
        language: parsed.language || "English",
        sentiment: parsed.sentiment || "Neutral",
        score: typeof parsed.score === 'number' ? parsed.score : 60,
        openingStatus: parsed.openingStatus || "Standard",
        tone: parsed.tone || "Neutral",
        energyLevel: parsed.energyLevel || "Normal",
        activeListening: parsed.activeListening || "Adequate",
        summary: parsed.summary || "Conversation transcribed.",
        coachingFeedback: parsed.coachingFeedback || "No specific coaching feedback provided."
      };
    } catch (e) {
      this.logger.error(`Failed to parse JSON safely: ${cleaned}`);
      // Smarter fallback using heuristic analysis
      return this.buildHeuristicFallback(raw, transcript);
    }
  }

  private buildHeuristicFallback(response: string, transcript: string): AIAnalysisResult {
    const lower = transcript.toLowerCase();
    
    // Detect sentiment from keywords
    const positiveSentiments = (lower.match(/thank|appreciate|perfect|great|excellent|satisfied|happy|resolved|solved/gi) || []).length;
    const negativeSentiments = (lower.match(/complaint|issue|problem|angry|frustrated|upset|dissatisfied|refund|cancel/gi) || []).length;
    
    let sentiment = "Neutral";
    if (negativeSentiments > positiveSentiments) {
      sentiment = negativeSentiments > 2 ? "Frustrated" : "Negative";
    } else if (positiveSentiments > negativeSentiments) {
      sentiment = "Positive";
    }

    // Calculate heuristic score
    let score = 70;
    score += Math.min(positiveSentiments * 3, 15);
    score -= Math.min(negativeSentiments * 4, 20);
    if (transcript.includes("sorry") || transcript.includes("apologize")) score += 3;
    if (transcript.match(/resolved|completed|finished|done/i)) score += 5;
    score = Math.max(35, Math.min(95, score));

    const hasGreeting = /hello|hi|good morning|namaste/i.test(transcript);
    const hasClosure = /thank|goodbye|have a|take care/i.test(transcript);

    return {
      language: this.detectLanguageFromTranscript(transcript),
      sentiment,
      score: Math.round(score),
      openingStatus: hasGreeting ? "Professional" : "Direct",
      tone: sentiment === "Frustrated" ? "Tense" : sentiment === "Positive" ? "Friendly" : "Neutral",
      energyLevel: score > 80 ? "Engaged" : score > 60 ? "Calm" : "Low",
      activeListening: /understand|see|hear|acknowledge/i.test(transcript) ? "Good" : "Fair",
      summary: `Call transcribed. Sentiment detected: ${sentiment}. ${hasClosure ? "Call ended professionally." : ""}`,
      coachingFeedback: score > 80 
        ? "Strong call handling. Maintain current approach." 
        : score > 60 
          ? "Good foundation. Focus on clarity and faster resolution." 
          : "Review conversation pacing and customer empathy."
    };
  }

  private detectLanguageFromTranscript(transcript: string): string {
    const devanagariCount = (transcript.match(/[\u0900-\u097F]/g) || []).length;
    const hindiKeywords = /है|नहीं|क्या|मैं|आप|कृपया|मुझे/g.test(transcript);
    const marathiKeywords = /आहे|तुम्ही|काय|मला|झाले|बरं/g.test(transcript);
    
    if (devanagariCount > 20) {
      return hindiKeywords ? "Hindi" : marathiKeywords ? "Marathi" : "Hindi";
    }
    if (hindiKeywords) return "Hindi";
    if (marathiKeywords) return "Marathi";
    return "English";
  }
}
