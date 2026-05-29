import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, AlertTriangle } from "lucide-react";

import type { AnalysisRecord } from "@/services/analysis.service";

interface AnalysisDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AnalysisRecord | null;
}

const AnalysisDetailsModal = ({
  isOpen,
  onClose,
  record,
}: AnalysisDetailsModalProps) => {
  if (!record) return null;

  const isInProgress = !["Completed", "Failed", "Timeout"].includes(record.status || "");

  const safeValue = (
    value: string | null | undefined,
    processingFallback: string = record.status || "Processing...",
  ) => {
    if (value) return value;
    if (isInProgress) return processingFallback;
    return "—";
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border bg-bg-muted/30 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-fg">Analysis Details</h3>
                <p className="text-xs text-fg-subtle">
                  Record ID: {record.id} • {record.createdAt}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-fg-subtle transition-colors hover:bg-bg-muted hover:text-fg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[80vh] space-y-8 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                  <p className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
                    Agent
                  </p>
                  <p className="truncate text-sm font-semibold text-fg">
                    {record.agentId}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                  <p className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
                    Language
                  </p>
                  <p className="text-sm font-semibold text-fg">
                    {safeValue(record.language, "Detecting...")}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                  <p className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
                    AI Score
                  </p>
                  <p
                    className={`text-xl font-black ${
                      record.score !== null
                        ? record.score >= 80
                          ? "text-success"
                          : record.score >= 60
                            ? "text-warning"
                            : "text-danger"
                        : isInProgress
                          ? "text-info"
                          : "text-fg-subtle"
                    }`}
                  >
                    {record.score !== null
                      ? `${record.score}%`
                      : isInProgress
                        ? "Calculating..."
                        : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                  <p className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
                    Sentiment
                  </p>
                  <p className="break-words text-sm font-medium text-fg">
                    {safeValue(record.sentiment)}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                  <p className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
                    Opening Status
                  </p>
                  <p
                    className="truncate text-sm font-medium text-fg"
                    title={record.openingStatus || ""}
                  >
                    {safeValue(record.openingStatus)}
                  </p>
                </div>
              </div>

              {record.status === "Failed" && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-danger">
                    <AlertTriangle className="h-5 w-5" />
                    <h4 className="font-bold">Backend Failure</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-fg">
                    {record.statusReason || "The backend did not return an error message."}
                  </p>
                </div>
              )}

              {record.status === "Timeout" && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
                  <div className="mb-2 flex items-center gap-2 text-danger">
                    <AlertTriangle className="h-5 w-5" />
                    <h4 className="font-bold">Analysis Timeout</h4>
                  </div>
                  <p className="text-sm leading-relaxed text-fg">
                    {record.statusReason || "The AI analysis job exceeded the maximum timeout limit."}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-fg">
                  <ShieldAlert className="h-5 w-5 text-warning" />
                  <h4 className="font-bold">AI Summary</h4>
                </div>
                <p className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-fg">
                  {record.summary ||
                    (isInProgress
                      ? "The backend is still building the structured AI summary."
                      : "No AI summary is available for this call yet.")}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-fg">Coaching Feedback</h4>
                <p className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-fg">
                  {record.coachingFeedback ||
                    record.result ||
                    (isInProgress
                      ? "The backend is still generating coaching feedback."
                      : "No coaching feedback is available for this call yet.")}
                </p>
              </div>

              {(record.status === "Completed" ||
                record.tone ||
                record.energyLevel ||
                record.activeListening) && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
                      Tone
                    </p>
                    <p className="text-sm font-semibold text-fg">
                      {safeValue(record.tone)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
                      Energy Level
                    </p>
                    <p className="text-sm font-semibold text-fg">
                      {safeValue(record.energyLevel)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-bg-muted/50 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
                      Active Listening
                    </p>
                    <p className="text-sm font-semibold text-fg">
                      {safeValue(record.activeListening)}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-bold text-fg">Call Transcript</h4>
                <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-bg-muted/30 p-4 font-mono text-xs leading-relaxed text-fg">
                  {record.transcription || "No transcription available."}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border bg-bg-muted/10 px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-lg bg-bg-muted px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-border"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AnalysisDetailsModal;
