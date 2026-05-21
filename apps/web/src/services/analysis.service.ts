import { api } from "./api";

export interface AnalysisRecord {
  id: string;
  agent: string;
  agentId?: string;
  sentiment: string | null;
  score: number | null;
  result: string | null;
  coachingFeedback?: string | null;
  summary?: string | null;
  transcription?: string | null;
  status: "Pending" | "Processing" | "Completed" | "Failed" | "Retrying" | "Uploading" | "Processing Audio" | "Generating Transcript" | "Detecting Language" | "Running AI Analysis" | "Saving Results" | "Transcribing" | "Timeout";
  language?: string | null;
  statusReason?: string | null;
  createdAt: string;
  openingStatus?: string | null;
  openingReason?: string;
  openingDelay?: string | null;
  openingScore?: number | null;
  openingFeedback?: string | null;
  tone?: string | null;
  energyLevel?: string | null;
  activeListening?: string | null;
}

export const getAnalysisRecords = async (): Promise<AnalysisRecord[]> => {
  const response = await api.get<{ success: boolean; data: AnalysisRecord[] }>("/analysis/recordings");
  return response.data?.data || [];
};

/**
 * Triggers background analysis for a specific recording ID.
 * Returns immediately so the dashboard can manage the polling state.
 */
export const analyzeRecording = async (id: string): Promise<AnalysisRecord> => {
  const response = await api.post<{ success: boolean; analysis: AnalysisRecord }>(`/analysis/analyze/${id}`);
  if (!response.data?.success || !response.data?.analysis) {
    throw new Error((response.data as { error?: string } | undefined)?.error || "Failed to queue analysis");
  }
  return response.data.analysis;
};
