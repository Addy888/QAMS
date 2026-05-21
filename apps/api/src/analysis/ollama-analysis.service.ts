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
  customerMood: string;
  resolutionQuality: string;
  escalationRisk: string;
}

@Injectable()
export class OllamaAnalysisService {
  private readonly logger = new Logger(OllamaAnalysisService.name);

  async analyzeTranscript(transcript: string): Promise<AIAnalysisResult> {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const ollamaModel = process.env.OLLAMA_MODEL || "llama3";
    const ollamaTimeout = Number(process.env.OLLAMA_TIMEOUT_MS) || 60000;

    const prompt = `You are an expert QA auditor analyzing real Indian customer support conversations.

Analyze the ACTUAL transcript carefully.
Every response must be based ONLY on transcript behavior.

Do NOT generate generic answers.
Do NOT reuse repetitive outputs.
Evaluate naturally and realistically.

The conversation may contain:
- Hindi
- Marathi
- Hinglish
- mixed-language speech

Evaluate:
- customer mood
- agent professionalism
- empathy
- listening quality
- issue resolution
- communication clarity
- confidence
- interruptions
- escalation handling

Generate realistic scoring based on transcript quality.
- Excellent calls -> 85-95
- Average calls -> 60-80
- Weak calls -> 40-60

Return ONLY valid JSON matching this exact structure:
{
  "language": "Hindi",
  "sentiment": "Positive",
  "score": 82,
  "openingStatus": "Warm and Professional",
  "tone": "Empathetic and Friendly",
  "energyLevel": "Moderately Engaged",
  "activeListening": "Strong",
  "summary": "...",
  "coachingFeedback": "...",
  "customerMood": "...",
  "resolutionQuality": "...",
  "escalationRisk": "Low"
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
            temperature: 0.7, // Increased for creativity
            top_p: 0.9,
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
        score: typeof parsed.score === 'number' ? parsed.score : 65,
        openingStatus: parsed.openingStatus || "Standard",
        tone: parsed.tone || "Neutral",
        energyLevel: parsed.energyLevel || "Normal",
        activeListening: parsed.activeListening || "Adequate",
        summary: parsed.summary || "Conversation transcribed.",
        coachingFeedback: parsed.coachingFeedback || "No specific coaching feedback provided.",
        customerMood: parsed.customerMood || "Neutral",
        resolutionQuality: parsed.resolutionQuality || "Average",
        escalationRisk: parsed.escalationRisk || "Low"
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
    const negativeSentiments = (lower.match(/complaint|issue|problem|angry|frustrated|upset|dissatisfied|refund|cancel|manager|escalate/gi) || []).length;
    
    let sentiment = "Neutral";
    let customerMood = "Neutral";
    let escalationRisk = "Low";

    if (negativeSentiments > positiveSentiments) {
      sentiment = negativeSentiments > 2 ? "Frustrated" : "Negative";
      customerMood = negativeSentiments > 3 ? "Angry" : "Unhappy";
      escalationRisk = lower.includes("manager") || lower.includes("escalate") ? "High" : "Medium";
    } else if (positiveSentiments > negativeSentiments) {
      sentiment = "Positive";
      customerMood = "Satisfied";
    }

    // Calculate heuristic score dynamically
    let score = 65; // Base average
    score += Math.min(positiveSentiments * 4, 20);
    score -= Math.min(negativeSentiments * 5, 25);
    if (transcript.includes("sorry") || transcript.includes("apologize")) score += 4;
    if (transcript.match(/resolved|completed|finished|done|helped/i)) score += 6;
    
    // Add some random natural variation to the fallback score so it's never exactly the same
    score += Math.floor(Math.random() * 5) - 2; 
    score = Math.max(35, Math.min(95, score));

    const hasGreeting = /hello|hi|good morning|namaste|swagat/i.test(transcript);
    const hasClosure = /thank|goodbye|have a|take care|dhanyawad/i.test(transcript);

    let resolutionQuality = score > 80 ? "Excellent" : score > 60 ? "Average" : "Poor";

    return {
      language: this.detectLanguageFromTranscript(transcript),
      sentiment,
      score: Math.round(score),
      openingStatus: hasGreeting ? "Warm and Professional" : "Direct",
      tone: sentiment === "Frustrated" ? "Tense but Professional" : sentiment === "Positive" ? "Empathetic and Friendly" : "Neutral",
      energyLevel: score > 80 ? "Highly Engaged" : score > 60 ? "Moderately Engaged" : "Low Energy",
      activeListening: /understand|see|hear|acknowledge|samajh/i.test(transcript) ? "Strong" : "Fair",
      summary: `Call transcribed and analyzed heuristically. Customer mood detected as ${customerMood}. ${hasClosure ? "Call concluded with standard closing." : ""}`,
      coachingFeedback: score > 80 
        ? "Excellent handling of the customer's queries. Maintain this empathetic approach." 
        : score > 60 
          ? "Good foundation, but try to actively listen more and improve issue resolution speed." 
          : "Review the call pacing. Focus on acknowledging the customer's frustration and offering clear solutions.",
      customerMood,
      resolutionQuality,
      escalationRisk
    };
  }

  private detectLanguageFromTranscript(transcript: string): string {
    const devanagariCount = (transcript.match(/[\u0900-\u097F]/g) || []).length;
    const hindiKeywords = /है|नहीं|क्या|मैं|आप|कृपया|मुझे|नमस्ते|धन्यवाद/g.test(transcript);
    const marathiKeywords = /आहे|तुम्ही|काय|मला|झाले|बरं/g.test(transcript);
    
    if (devanagariCount > 20) {
      return hindiKeywords ? "Hindi" : marathiKeywords ? "Marathi" : "Hindi";
    }
    if (hindiKeywords) return "Hindi";
    if (marathiKeywords) return "Marathi";
    return "English";
  }
}
