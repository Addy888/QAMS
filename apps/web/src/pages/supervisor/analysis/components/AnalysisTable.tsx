import { useState } from "react";
import StatusBadge from "./StatusBadge";
import AnalysisDetailsModal from "./AnalysisDetailsModal";
import { FileText, Play, RefreshCw, Download, BookOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { analyzeRecording, type AnalysisRecord } from "@/services/analysis.service";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/services/api";

interface AnalysisTableProps {
  data: AnalysisRecord[];
  onUpdateRecord: (record: AnalysisRecord) => void;
  onRefetch?: () => void;
}

const AnalysisTable = ({ data, onUpdateRecord, onRefetch }: AnalysisTableProps) => {
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const handleViewDetails = (record: AnalysisRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleAnalyze = async (id: string) => {
    const currentRecord = data.find(r => r.id === id);
    if (!currentRecord) return;

    setAnalyzingId(id);

    // Optimistic UI — show Processing immediately
    onUpdateRecord({
      ...currentRecord,
      status: 'Processing',
      statusReason: 'AI is analyzing the call…',
    });

    const toastId = toast.loading('AI is analyzing call… this may take up to 90 seconds.');

    try {
      // Trigger background analysis and update UI state
      const result = await analyzeRecording(id);
      onUpdateRecord(result);
      toast.success('AI analysis completed successfully!', { id: toastId });
      
      // Auto-refetch the dashboard to update stats and list
      if (onRefetch) {
        await onRefetch();
      }
      window.dispatchEvent(new CustomEvent('refetch-analysis'));
    } catch (error) {
      console.error('Analysis failed:', error);
      toast.error('AI Analysis failed to start — check backend logs.', { id: toastId });
      onUpdateRecord({
        ...currentRecord,
        status: 'Failed',
        statusReason: 'Client-side error starting analysis',
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleReanalyze = async (id: string) => {
    const currentRecord = data.find(r => r.id === id);
    if (!currentRecord) return;

    setAnalyzingId(id);

    // Optimistic UI state reset
    onUpdateRecord({
      ...currentRecord,
      status: 'Pending',
      statusReason: 'Re-queued for fresh AI analysis...',
      sentiment: null,
      score: null,
      openingStatus: null,
      tone: null,
      energyLevel: null,
      activeListening: null,
      summary: null,
    });

    const toastId = toast.loading('Re-queuing call for fresh AI analysis...');

    try {
      const response = await fetch(`${getApiBaseUrl()}/analysis/reanalyze/${id}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Reanalysis trigger failed");
      const result = await response.json();
      
      if (result.success && result.analysis) {
        onUpdateRecord(result.analysis);
        toast.success('Reanalysis job successfully queued!', { id: toastId });
      } else {
        throw new Error(result.error || "Failed to start reanalysis");
      }
      
      if (onRefetch) {
        await onRefetch();
      }
      window.dispatchEvent(new CustomEvent('refetch-analysis'));
    } catch (error: any) {
      console.error('Reanalysis failed:', error);
      toast.error(error.message || 'Failed to start fresh AI analysis.', { id: toastId });
      onUpdateRecord(currentRecord); // restore old state
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDownloadTranscript = (item: AnalysisRecord) => {
    if (!item.transcription) {
      toast.error("No transcription available for this call recording.");
      return;
    }

    const blob = new Blob([
      `QAMS AI CALL TRANSCRIPTION REPORT\n`,
      `=================================\n`,
      `Record ID: ${item.id}\n`,
      `Agent ID: ${item.agentId || '—'}\n`,
      `AI Score: ${item.score !== null ? item.score + '%' : '—'}\n`,
      `Sentiment: ${item.sentiment || '—'}\n`,
      `Created At: ${item.createdAt}\n`,
      `=================================\n\n`,
      `${item.transcription}`
    ], { type: "text/plain;charset=utf-8" });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `call_transcript_${item.id}.txt`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded successfully!");
  };

  const handleOpenFullAIReport = async (item: AnalysisRecord) => {
    const toastId = toast.loading(`Generating full AI PDF report for Call #${item.id}...`);
    try {
      const url = `${getApiBaseUrl()}/analysis/export?format=pdf&search=${item.id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to generate PDF report");
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `ai_report_${item.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      
      toast.success("Full AI Report downloaded successfully!", { id: toastId });
    } catch (error) {
      console.error("Failed to generate AI report:", error);
      toast.error("Failed to download full AI PDF report.", { id: toastId });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  return (
    <>
      <div className="w-full overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-muted/50">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">Agent Name</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Language</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Sentiment</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Score</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">Opening Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Tone</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">Energy Level</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">Active Listening</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Status</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">Created Date</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.map((item) => (
                <tr key={item.id} className="hover:bg-bg-muted/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-fg">{item.agentId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent/15 text-accent border border-accent/20">
                      {item.language || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-fg max-w-[150px] truncate block" title={item.sentiment || ""}>
                      {item.sentiment || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                       "text-sm font-bold",
                       (item.score ?? 0) >= 80 ? "text-success" : (item.score ?? 0) >= 60 ? "text-warning" : "text-danger"
                    )}>
                        {item.score !== null ? `${item.score}%` : "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-fg max-w-[150px] truncate block" title={item.openingStatus || ""}>
                      {item.openingStatus || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-fg max-w-[150px] truncate block" title={item.tone || ""}>
                      {item.tone || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-fg max-w-[150px] truncate block" title={item.energyLevel || ""}>
                      {item.energyLevel || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-fg max-w-[150px] truncate block" title={item.activeListening || ""}>
                      {item.activeListening || "—"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={item.status === "Pending" && analyzingId === item.id ? "Processing" : item.status} />
                      <span className="text-[10px] text-fg-subtle italic max-w-[120px] leading-tight">
                        {item.statusReason || (item.status === "Pending" ? "Waiting for analysis" : "")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-fg-subtle whitespace-nowrap">{formatDate(item.createdAt)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                      {/* View Details */}
                      <button 
                        onClick={() => handleViewDetails(item)}
                        className="p-1.5 rounded-md hover:bg-bg-muted text-fg-subtle hover:text-accent transition-all" 
                        title="View Details"
                      >
                        <FileText className="h-4 w-4" />
                      </button>

                      {/* Reanalyze Call */}
                      <button 
                        onClick={() => handleReanalyze(item.id)}
                        disabled={analyzingId === item.id || item.status === "Processing"}
                        className="p-1.5 rounded-md hover:bg-bg-muted text-fg-subtle hover:text-accent transition-all disabled:opacity-30" 
                        title="Reanalyze Call"
                      >
                        <RefreshCw className={cn("h-4 w-4", analyzingId === item.id && "animate-spin")} />
                      </button>

                      {/* Download Transcript */}
                      <button 
                        onClick={() => handleDownloadTranscript(item)}
                        disabled={!item.transcription}
                        className="p-1.5 rounded-md hover:bg-bg-muted text-fg-subtle hover:text-accent transition-all disabled:opacity-30" 
                        title="Download Transcript"
                      >
                        <Download className="h-4 w-4" />
                      </button>

                      {/* Open Full AI Report */}
                      <button 
                        onClick={() => handleOpenFullAIReport(item)}
                        disabled={item.status !== "Completed"}
                        className="p-1.5 rounded-md hover:bg-bg-muted text-fg-subtle hover:text-accent transition-all disabled:opacity-30" 
                        title="Open Full AI Report"
                      >
                        <BookOpen className="h-4 w-4" />
                      </button>

                      {/* Manual Trigger Play button if pending/failed */}
                      {(item.status === "Pending" || item.status === "Failed") && analyzingId !== item.id && (
                        <button 
                          onClick={() => handleAnalyze(item.id)}
                          className="p-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all shadow-sm" 
                          title="Start AI Analysis"
                        >
                          <Play className="h-4 w-4 fill-current" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnalysisDetailsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        record={selectedRecord} 
      />
    </>
  );
};

export default AnalysisTable;
