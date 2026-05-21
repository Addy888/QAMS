import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

export type SupportedLanguage = "English" | "Hindi" | "Marathi" | "Hinglish";

export interface LanguageDetectionResult {
  language: SupportedLanguage;
  provider: string;
  rawResponse: string;
  method: "heuristic" | "whisper";
}

export interface StructuredAnalysisResult {
  language: SupportedLanguage;
  sentiment: string;
  score: number;
  tone: string;
  energyLevel: string;
  activeListening: string;
  openingStatus: string;
  summary: string;
  coachingFeedback: string;
  rawResponse: string;
  provider: string;
  model: string;
  parsedJson: Record<string, unknown>;
  usedFallback: boolean;
  parserWarnings: string[];
}

type PartialAnalysis = Partial<StructuredAnalysisResult> & {
  parsedJson?: Record<string, unknown>;
};

const LANGUAGE_VALUES: SupportedLanguage[] = [
  "English",
  "Hindi",
  "Marathi",
  "Hinglish",
];

const SENTIMENT_VALUES = ["Positive", "Neutral", "Negative", "Frustrated"];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  async detectLanguage(
    transcript: string,
    recordingId: string,
    whisperLanguageCode?: string | null,
  ): Promise<LanguageDetectionResult> {
    const language = this.detectLanguageHeuristically(
      transcript,
      whisperLanguageCode,
    );
    const rawResponse = JSON.stringify(
      {
        transcriptLength: transcript.length,
        whisperLanguageCode: whisperLanguageCode ?? null,
        detectedLanguage: language,
      },
      null,
      2,
    );

    this.logger.log(
      `[Language][${recordingId}] method=${whisperLanguageCode ? "whisper+heuristic" : "heuristic"} detected=${language} whisper=${whisperLanguageCode ?? "n/a"}`,
    );

    return {
      language,
      provider: whisperLanguageCode ? "faster-whisper" : "heuristic",
      rawResponse,
      method: whisperLanguageCode ? "whisper" : "heuristic",
    };
  }

  async analyzeTranscript(
    transcript: string,
    detectedLanguage: SupportedLanguage,
    recordingId: string,
  ): Promise<StructuredAnalysisResult> {
    this.assertTranscriptValid(transcript);

    const model = process.env.OLLAMA_MODEL?.trim() || "llama3:latest";
    const messages = [
      {
        role: "system",
        content: [
          "You are analyzing real Indian customer support conversations.",
          "Conversations may contain Hindi, Marathi, Hinglish, or mixed-language speech.",
          "Evaluate naturally without penalizing regional languages.",
          "Return strict JSON only with these keys:",
          "language, sentiment, score, openingStatus, tone, energyLevel, activeListening, summary, coachingFeedback",
          "Score guidance:",
          "- average calls should usually score between 60 and 80",
          "- excellent calls should usually score between 85 and 100",
          "- poor calls should be below 50 only when they are genuinely poor",
          "- never default the score to 0",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Detected language before analysis: ${detectedLanguage}.`,
          "Use one of these language values only: English, Hindi, Marathi, Hinglish.",
          "Use one of these sentiment values only: Positive, Neutral, Negative, Frustrated.",
          "Respond with valid JSON only.",
          "Expected JSON shape:",
          JSON.stringify(
            {
              language: detectedLanguage,
              sentiment: "Positive",
              score: 78,
              openingStatus: "Professional",
              tone: "Friendly",
              energyLevel: "Calm",
              activeListening: "Good",
              summary: "Customer issue handled professionally.",
              coachingFeedback: "Improve response speed slightly.",
            },
            null,
            2,
          ),
          "",
          "Transcript:",
          transcript.trim(),
        ].join("\n"),
      },
    ];

    const warnings: string[] = [];
    const primaryResponse = await this.requestOllama(messages, model, recordingId);
    let parsed = this.tryParseAnalysisJson(primaryResponse.rawText, warnings);

    if (!parsed) {
      warnings.push("Primary Ollama response was not valid JSON.");
      const repairResponse = await this.requestRepair(
        primaryResponse.rawText,
        detectedLanguage,
        model,
        recordingId,
      );
      const repaired = this.tryParseAnalysisJson(repairResponse.rawText, warnings);
      if (repaired) {
        parsed = repaired;
      }
    }

    const usedFallback = !parsed;
    const fallback = this.buildHeuristicAnalysis(transcript, detectedLanguage);
    const normalized = this.normalizeAnalysis(
      parsed ?? {},
      fallback,
      detectedLanguage,
    );

    if (usedFallback) {
      warnings.push("Using deterministic fallback analysis because Ollama JSON could not be parsed safely.");
    }

    this.logger.log(
      `[AI][${recordingId}] provider=Ollama model=${model} fallback=${usedFallback} score=${normalized.score} sentiment=${normalized.sentiment}`,
    );

    return {
      ...normalized,
      rawResponse: primaryResponse.rawText,
      provider: "Ollama",
      model,
      parsedJson: parsed ?? fallback.parsedJson ?? {},
      usedFallback,
      parserWarnings: warnings,
    };
  }

  getDiagnostics() {
    return {
      ollamaUrl: this.getOllamaBaseUrl(),
      ollamaModel: process.env.OLLAMA_MODEL?.trim() || "llama3:latest",
      requestTimeoutMs: this.getTimeoutMs(),
    };
  }

  private async requestOllama(
    messages: Array<{ role: string; content: string }>,
    model: string,
    recordingId: string,
  ) {
    const payload = {
      model,
      stream: false,
      format: "json",
      keep_alive: process.env.OLLAMA_KEEP_ALIVE?.trim() || "20m",
      options: {
        temperature: 0.2,
        num_predict: this.getNumPredict(),
      },
      messages,
    };

    try {
      const response = await axios.post(
        `${this.getOllamaBaseUrl()}/api/chat`,
        payload,
        {
          timeout: this.getTimeoutMs(),
        },
      );

      const rawText = String(
        response.data?.message?.content ?? response.data?.response ?? "",
      ).trim();

      if (!rawText) {
        throw new Error("Ollama returned an empty response body.");
      }

      this.logger.log(
        `[AI][${recordingId}] Ollama raw response preview=${rawText.slice(0, 800)}`,
      );

      return {
        rawText,
        meta: {
          totalDuration: response.data?.total_duration ?? null,
          evalCount: response.data?.eval_count ?? null,
        },
      };
    } catch (error: any) {
      const status = error.response?.status;
      const detail = JSON.stringify(error.response?.data ?? {}).slice(0, 1000);
      throw new Error(
        `Ollama request failed${status ? ` with status ${status}` : ""}: ${detail || error.message}`,
      );
    }
  }

  private async requestRepair(
    rawText: string,
    detectedLanguage: SupportedLanguage,
    model: string,
    recordingId: string,
  ) {
    return this.requestOllama(
      [
        {
          role: "system",
          content:
            "You repair malformed JSON for a local call-analysis pipeline. Return valid JSON only.",
        },
        {
          role: "user",
          content: [
            `Detected language: ${detectedLanguage}.`,
            "Convert the following model output into valid JSON with only these keys:",
            "language, sentiment, score, openingStatus, tone, energyLevel, activeListening, summary, coachingFeedback",
            "",
            rawText,
          ].join("\n"),
        },
      ],
      model,
      `${recordingId}:repair`,
    );
  }

  private normalizeAnalysis(
    parsed: Record<string, unknown>,
    fallback: PartialAnalysis,
    detectedLanguage: SupportedLanguage,
  ): Omit<
    StructuredAnalysisResult,
    "rawResponse" | "provider" | "model" | "parsedJson" | "usedFallback" | "parserWarnings"
  > {
    const language = this.normalizeLanguage(
      parsed.language,
      String(parsed.summary ?? ""),
      detectedLanguage,
    );

    const sentiment = this.normalizeSentiment(parsed.sentiment) ?? fallback.sentiment!;
    const score = this.normalizeScore(parsed.score, fallback.score!);
    const openingStatus =
      this.normalizeFreeText(parsed.openingStatus, 3) ?? fallback.openingStatus!;
    const tone = this.normalizeFreeText(parsed.tone, 3) ?? fallback.tone!;
    const energyLevel =
      this.normalizeFreeText(parsed.energyLevel, 3) ?? fallback.energyLevel!;
    const activeListening =
      this.normalizeFreeText(parsed.activeListening, 3) ??
      fallback.activeListening!;
    const summary =
      this.normalizeFreeText(parsed.summary, 12) ?? fallback.summary!;
    const coachingFeedback =
      this.normalizeFreeText(parsed.coachingFeedback, 12) ??
      fallback.coachingFeedback!;

    return {
      language,
      sentiment,
      score,
      openingStatus,
      tone,
      energyLevel,
      activeListening,
      summary,
      coachingFeedback,
    };
  }

  private tryParseAnalysisJson(
    rawText: string,
    warnings: string[],
  ): Record<string, unknown> | null {
    const candidates = [
      rawText,
      rawText.replace(/^```json/i, "").replace(/```$/i, "").trim(),
      this.extractFirstJsonObject(rawText),
    ].filter((value): value is string => !!value);

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        continue;
      }
    }

    warnings.push(`Unable to parse Ollama JSON: ${rawText.slice(0, 300)}`);
    return null;
  }

  private extractFirstJsonObject(value: string) {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    return value.slice(start, end + 1).trim();
  }

  private buildHeuristicAnalysis(
    transcript: string,
    detectedLanguage: SupportedLanguage,
  ): PartialAnalysis {
    const normalizedTranscript = transcript.toLowerCase();
    const positiveSignals = this.countSignals(normalizedTranscript, [
      "thank",
      "thanks",
      "resolved",
      "helped",
      "appreciate",
      "thank you",
      "dhanyavaad",
      "shukriya",
      "ho gaya",
      "samajh gaya",
      "theek hai",
      "barobar",
      "dhanyavad",
    ]);
    const negativeSignals = this.countSignals(normalizedTranscript, [
      "complaint",
      "issue",
      "problem",
      "angry",
      "frustrated",
      "cancel",
      "nahi hua",
      "galat",
      "late",
      "delay",
      "hold",
      "escalate",
      "not happy",
      "refund",
    ]);
    const hasGreeting = /(hello|hi|good morning|good afternoon|namaste|namaskar)/i.test(
      transcript,
    );
    const hasEmpathy = /(sorry|understand|samajh|i can help|let me check|mai dekh|mi baghto)/i.test(
      transcript,
    );
    const hasResolution = /(resolved|done|complete|ho gaya|solve|updated|shared|sent)/i.test(
      transcript,
    );

    let score = 72;
    score += Math.min(positiveSignals * 4, 12);
    score -= Math.min(negativeSignals * 6, 28);
    if (hasGreeting) score += 4;
    if (hasEmpathy) score += 5;
    if (hasResolution) score += 6;
    if (transcript.length < 180) score -= 8;
    score = Math.max(35, Math.min(96, score));

    let sentiment = "Neutral";
    if (negativeSignals >= 3 && !hasResolution) {
      sentiment = "Frustrated";
    } else if (negativeSignals >= 2) {
      sentiment = "Negative";
    } else if (positiveSignals >= 2 || hasResolution) {
      sentiment = "Positive";
    }

    const summarySnippet = this.createSummarySnippet(transcript, 220);
    const summary = hasResolution
      ? `Customer concern was discussed and moved toward resolution. Key context: ${summarySnippet}`
      : `Customer concern was reviewed locally from the call transcript. Key context: ${summarySnippet}`;

    const coachingFeedback =
      score >= 85
        ? "Strong call handling overall. Keep the clear acknowledgement and resolution style, and continue closing the call with explicit next steps."
        : score >= 60
          ? "Good foundation overall. Improve clarity on next steps and tighten response pacing so the customer hears confirmation sooner."
          : "This call needs coaching on empathy, control of the conversation, and clearer ownership of the customer issue before closing.";

    const tone =
      sentiment === "Frustrated"
        ? "Tense"
        : hasEmpathy
          ? "Empathetic"
          : hasGreeting
            ? "Professional"
            : "Direct";

    return {
      language: detectedLanguage,
      sentiment,
      score,
      openingStatus: hasGreeting ? "Professional" : "Needs Improvement",
      tone,
      energyLevel: score >= 82 ? "Engaged" : score >= 60 ? "Calm" : "Low",
      activeListening:
        hasEmpathy || hasResolution
          ? "Good"
          : transcript.length > 250
            ? "Fair"
            : "Needs Improvement",
      summary,
      coachingFeedback,
      parsedJson: {
        language: detectedLanguage,
        sentiment,
        score,
        openingStatus: hasGreeting ? "Professional" : "Needs Improvement",
        tone,
        energyLevel: score >= 82 ? "Engaged" : score >= 60 ? "Calm" : "Low",
        activeListening:
          hasEmpathy || hasResolution ? "Good" : "Needs Improvement",
        summary,
        coachingFeedback,
      },
    };
  }

  private createSummarySnippet(transcript: string, maxLength: number) {
    const cleaned = transcript.replace(/\s+/g, " ").trim();
    const snippet = cleaned.slice(0, maxLength);
    return snippet.length < cleaned.length ? `${snippet}...` : snippet;
  }

  private countSignals(transcript: string, signals: string[]) {
    return signals.reduce(
      (total, signal) => total + (transcript.includes(signal) ? 1 : 0),
      0,
    );
  }

  private normalizeLanguage(
    value: unknown,
    transcript: string,
    fallback: SupportedLanguage,
  ): SupportedLanguage {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      const matched = LANGUAGE_VALUES.find(
        (item) => item.toLowerCase() === normalized,
      );
      if (matched) {
        return matched;
      }
    }

    return this.detectLanguageHeuristically(transcript, fallback);
  }

  private normalizeSentiment(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    const matched = SENTIMENT_VALUES.find(
      (item) => item.toLowerCase() === normalized,
    );
    return matched ?? null;
  }

  private normalizeScore(value: unknown, fallback: number) {
    const score =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;

    if (!Number.isFinite(score)) {
      return fallback;
    }

    const rounded = Math.round(score);
    if (rounded <= 0) {
      return fallback;
    }

    return Math.max(35, Math.min(100, rounded));
  }

  private normalizeFreeText(value: unknown, minLength: number) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length >= minLength ? normalized : null;
  }

  private detectLanguageHeuristically(
    transcript: string,
    whisperLanguageCode?: string | null,
  ): SupportedLanguage {
    const lowered = transcript.toLowerCase();
    const devanagariChars = (transcript.match(/[\u0900-\u097F]/g) || []).length;
    const marathiSignals = this.countSignals(lowered, [
      "आहे",
      "तुम्ही",
      "काय",
      "मला",
      "झाले",
      "बरं",
      "bagha",
      "ahe",
      "tumhi",
      "kay",
      "mala",
      "barobar",
    ]);
    const hindiSignals = this.countSignals(lowered, [
      "है",
      "नहीं",
      "क्या",
      "मैं",
      "आप",
      "कृपया",
      "hai",
      "nahi",
      "kya",
      "aap",
      "mera",
      "samajh",
    ]);
    const englishSignals = this.countSignals(lowered, [
      "hello",
      "issue",
      "customer",
      "please",
      "support",
      "thanks",
      "account",
      "payment",
    ]);

    if (whisperLanguageCode === "mr" || marathiSignals >= 3) {
      if (englishSignals >= 2) {
        return "Hinglish";
      }
      return "Marathi";
    }

    if (whisperLanguageCode === "hi" || hindiSignals >= 3 || devanagariChars > 20) {
      if (englishSignals >= 2) {
        return "Hinglish";
      }
      return "Hindi";
    }

    if (
      englishSignals >= 2 &&
      (hindiSignals >= 2 || marathiSignals >= 2 || whisperLanguageCode === "en")
    ) {
      return "Hinglish";
    }

    if (whisperLanguageCode === "mr") {
      return "Marathi";
    }

    if (whisperLanguageCode === "hi") {
      return "Hindi";
    }

    if (hindiSignals >= 2 || marathiSignals >= 2) {
      return "Hinglish";
    }

    return "English";
  }

  private assertTranscriptValid(transcript: string) {
    const normalized = transcript.replace(/\s+/g, " ").trim();
    const minChars = Number(process.env.MIN_TRANSCRIPT_CHARS ?? 30);

    if (!normalized) {
      throw new Error("Transcript validation failed: transcript is empty.");
    }

    if (normalized.length < minChars) {
      throw new Error(
        `Transcript validation failed: transcript too short (${normalized.length} chars, minimum ${minChars}).`,
      );
    }
  }

  private getOllamaBaseUrl() {
    return (
      process.env.OLLAMA_URL?.trim() ||
      process.env.OLLAMA_API_URL?.trim() ||
      "http://127.0.0.1:11434"
    );
  }

  private getTimeoutMs() {
    const parsed = Number(process.env.OLLAMA_TIMEOUT_MS ?? 180000);
    return Number.isFinite(parsed) ? parsed : 180000;
  }

  private getNumPredict() {
    const parsed = Number(process.env.OLLAMA_NUM_PREDICT ?? 512);
    return Number.isFinite(parsed) ? parsed : 512;
  }
}
