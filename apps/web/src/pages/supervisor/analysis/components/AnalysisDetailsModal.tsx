import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert } from "lucide-react";
import type { AnalysisRecord } from "@/services/analysis.service";


interface AnalysisDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AnalysisRecord | null;
}

const AnalysisDetailsModal = ({ isOpen, onClose, record }: AnalysisDetailsModalProps) => {
  if (!record) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-bg-muted/30">
              <div>
                <h3 className="text-xl font-bold text-fg">Analysis Details</h3>
                <p className="text-xs text-fg-subtle">Record ID: {record.id} • {record.createdAt}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-bg-muted rounded-full transition-colors text-fg-subtle hover:text-fg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
              {/* Agent Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="p-4 bg-bg-muted/50 rounded-xl border border-border">
                  <p className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Agent</p>
                  <p className="text-sm font-semibold text-fg truncate">{record.agentId}</p>
                </div>
                <div className="p-4 bg-bg-muted/50 rounded-xl border border-border">
                  <p className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Language</p>
                  <p className="text-sm font-semibold text-fg">{record.language || "—"}</p>
                </div>
                <div className="p-4 bg-bg-muted/50 rounded-xl border border-border">
                  <p className="text-[10px] uppercase font-bold text-fg-subtle mb-1">AI Score</p>
                  <p className={`text-xl font-black ${(record.score ?? 0) >= 80 ? 'text-success' : (record.score ?? 0) >= 60 ? 'text-warning' : 'text-danger'}`}>
                    {record.score != null ? `${record.score}%` : "-"}
                  </p>
                </div>
                <div className="p-4 bg-bg-muted/50 rounded-xl border border-border">
                  <p className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Sentiment</p>
                  <p className="text-sm font-medium text-fg break-words">{record.sentiment || "—"}</p>
                </div>
                <div className="p-4 bg-bg-muted/50 rounded-xl border border-border">
                  <p className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Opening Status</p>
                  <p className="text-sm font-medium text-fg break-words truncate" title={record.openingStatus || ""}>{record.openingStatus || "—"}</p>
                </div>
              </div>

              {/* General Feedback / AI Summary */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-fg">
                  <ShieldAlert className="h-5 w-5 text-warning" />
                  <h4 className="font-bold">AI Summary</h4>
                </div>
                <p className="text-sm p-4 bg-surface border border-border rounded-xl text-fg leading-relaxed">
                  {record.summary || "No AI summary available yet. Run analysis to generate insights."}
                </p>
              </div>

              {/* Metrics Row */}
              {(record.tone || record.energyLevel || record.activeListening) && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-bg-muted/50 rounded-xl border border-border">
                    <p className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Tone</p>
                    <p className="text-sm font-semibold text-fg">{record.tone ?? "—"}</p>
                  </div>
                  <div className="p-4 bg-bg-muted/50 rounded-xl border border-border">
                    <p className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Energy Level</p>
                    <p className="text-sm font-semibold text-fg">{record.energyLevel ?? "—"}</p>
                  </div>
                  <div className="p-4 bg-bg-muted/50 rounded-xl border border-border">
                    <p className="text-[10px] uppercase font-bold text-fg-subtle mb-1">Active Listening</p>
                    <p className="text-sm font-semibold text-fg">{record.activeListening ?? "—"}</p>
                  </div>
                </div>
              )}

              {/* Call Transcript */}
              <div className="space-y-3">
                <h4 className="font-bold text-fg">Call Transcript</h4>
                <div className="p-4 bg-bg-muted/30 border border-border rounded-xl text-xs text-fg max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed font-mono">
                  {record.transcription || "No transcription available."}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-bg-muted/10 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-bg-muted hover:bg-border text-fg text-sm font-medium transition-colors"
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
