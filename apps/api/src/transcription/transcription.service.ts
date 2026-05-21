import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { resolveApiPath, resolveAudioPath } from "../analysis/runtime-paths";

export interface LocalTranscriptionResult {
  transcript: string;
  detectedLanguageCode: string | null;
  detectedLanguageProbability: number | null;
  durationSeconds: number | null;
  segmentCount: number;
  model: string;
  provider: "faster-whisper";
  rawOutput: string;
}

interface LocalRuntimeConfig {
  pythonBin: string;
  model: string;
  device: string;
  computeType: string;
  beamSize: number;
  vadFilter: boolean;
  cpuThreads: number;
  modelCacheDir?: string;
  initialPrompt: string;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  async transcribeAudio(
    audioPath: string,
    recordingId: string,
  ): Promise<LocalTranscriptionResult> {
    const absolutePath = resolveAudioPath(audioPath);
    const runtime = this.getRuntimeConfig();

    this.logger.log(
      `[Transcription][${recordingId}] START path=${audioPath} resolved=${absolutePath}`,
    );

    if (!fs.existsSync(absolutePath)) {
      throw new Error(
        `Audio validation failed: file not found at ${audioPath} (resolved ${absolutePath})`,
      );
    }

    const scriptPath = this.getTranscriptionScriptPath();
    const args = [
      scriptPath,
      "--audio-path",
      absolutePath,
      "--model",
      runtime.model,
      "--device",
      runtime.device,
      "--compute-type",
      runtime.computeType,
      "--beam-size",
      String(runtime.beamSize),
      "--cpu-threads",
      String(runtime.cpuThreads),
      "--initial-prompt",
      runtime.initialPrompt,
    ];

    if (runtime.vadFilter) {
      args.push("--vad-filter");
    }

    if (runtime.modelCacheDir) {
      args.push("--model-cache-dir", runtime.modelCacheDir);
    }

    const startedAt = Date.now();
    const { stdout, stderr, exitCode } = await this.runPythonProcess(
      runtime.pythonBin,
      args,
    );
    const durationMs = Date.now() - startedAt;

    if (exitCode !== 0) {
      const errorMessage = stderr.trim() || stdout.trim() || "Unknown failure";
      throw new Error(
        `Local transcription failed: ${errorMessage}. Ensure faster-whisper is installed and the configured model can run on this machine.`,
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stdout);
    } catch (error: any) {
      throw new Error(
        `Local transcription returned invalid JSON: ${error.message}. Raw output: ${stdout.slice(0, 500)}`,
      );
    }

    const transcript = String(parsed.transcript ?? "").trim();
    if (!transcript) {
      throw new Error(
        "Transcript validation failed: faster-whisper returned empty text.",
      );
    }

    const result: LocalTranscriptionResult = {
      transcript,
      detectedLanguageCode: this.asOptionalString(parsed.detectedLanguageCode),
      detectedLanguageProbability: this.asOptionalNumber(
        parsed.detectedLanguageProbability,
      ),
      durationSeconds: this.asOptionalNumber(parsed.durationSeconds),
      segmentCount: Number(parsed.segmentCount ?? 0) || 0,
      model: this.asOptionalString(parsed.model) || runtime.model,
      provider: "faster-whisper",
      rawOutput: stdout,
    };

    this.logger.log(
      `[Transcription][${recordingId}] Completed in ${durationMs}ms model=${result.model} language=${result.detectedLanguageCode ?? "unknown"} segments=${result.segmentCount} chars=${result.transcript.length}`,
    );

    return result;
  }

  getDiagnostics() {
    const runtime = this.getRuntimeConfig();
    const scriptPath = this.getTranscriptionScriptPath();

    return {
      pythonBin: runtime.pythonBin,
      model: runtime.model,
      device: runtime.device,
      computeType: runtime.computeType,
      beamSize: runtime.beamSize,
      vadFilter: runtime.vadFilter,
      cpuThreads: runtime.cpuThreads,
      scriptPath,
      scriptExists: fs.existsSync(scriptPath),
    };
  }

  private getRuntimeConfig(): LocalRuntimeConfig {
    return {
      pythonBin: process.env.LOCAL_PYTHON_BIN?.trim() || "python",
      model: process.env.FASTER_WHISPER_MODEL?.trim() || "small",
      device: process.env.FASTER_WHISPER_DEVICE?.trim() || "cpu",
      computeType:
        process.env.FASTER_WHISPER_COMPUTE_TYPE?.trim() || "int8",
      beamSize: this.parseInteger(process.env.FASTER_WHISPER_BEAM_SIZE, 1),
      vadFilter: this.parseBoolean(process.env.FASTER_WHISPER_VAD_FILTER, true),
      cpuThreads: this.parseInteger(process.env.FASTER_WHISPER_CPU_THREADS, 4),
      modelCacheDir: process.env.FASTER_WHISPER_MODEL_CACHE_DIR?.trim(),
      initialPrompt:
        process.env.FASTER_WHISPER_INITIAL_PROMPT?.trim() ||
        "This is a real Indian customer support call. The conversation may contain Hindi, Marathi, Hinglish, or mixed-language speech. Preserve names, numbers, and code-switched phrases naturally.",
    };
  }

  private getTranscriptionScriptPath() {
    const candidates = [
      resolveApiPath("scripts", "transcribe_audio.py"),
      path.resolve(process.cwd(), "apps", "api", "scripts", "transcribe_audio.py"),
      path.resolve(process.cwd(), "scripts", "transcribe_audio.py"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }

  private runPythonProcess(pythonBin: string, args: string[]) {
    return new Promise<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
    }>((resolve, reject) => {
      const child = spawn(pythonBin, args, {
        cwd: path.dirname(args[0]),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        reject(
          new Error(
            `Unable to start Python transcription worker using '${pythonBin}': ${error.message}`,
          ),
        );
      });

      child.on("close", (exitCode) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
        });
      });
    });
  }

  private parseBoolean(value: string | undefined, defaultValue: boolean) {
    if (!value) {
      return defaultValue;
    }

    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }

  private parseInteger(value: string | undefined, defaultValue: number) {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  private asOptionalString(value: unknown) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private asOptionalNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}
