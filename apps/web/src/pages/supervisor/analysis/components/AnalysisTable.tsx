import { useState } from "react";
import { FileText, Play, RefreshCw, Download, BookOpen } from "lucide-react";
import { toast } from "sonner";

import StatusBadge from "./StatusBadge";
import AnalysisDetailsModal from "./AnalysisDetailsModal";
import { cn } from "@/lib/utils";
import { analyzeRecording, type AnalysisRecord } from "@/services/analysis.service";
import { getApiBaseUrl } from "@/services/api";

interface AnalysisTableProps {
  data: AnalysisRecord[];
  onUpdateRecord: (record: AnalysisRecord) => void;
  onRefetch?: () => void;
}

const AnalysisTable = ({
  data,
  onUpdateRecord,
  onRefetch,
}: AnalysisTableProps) => {
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const handleViewDetails = (record: AnalysisRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleAnalyze = async (id: string) => {
    const currentRecord = data.find((row) => row.id === id);
    if (!currentRecord) return;

    setAnalyzingId(id);
    onUpdateRecord({
      ...currentRecord,
      status: "Pending",
      statusReason: "Queued for real production AI analysis...",
    });

    const toastId = toast.loading(
      "AI analysis has been queued. The transcript and scoring pipeline are starting now.",
    );

    try {
      const result = await analyzeRecording(id);
      if (result) {
        onUpdateRecord(result);
      }

      toast.success("AI analysis queued successfully.", { id: toastId });

      if (onRefetch) {
        await onRefetch();
      }
      window.dispatchEvent(new CustomEvent("refetch-analysis"));
    } catch (error: any) {
      const backendError =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Unknown backend error";

      console.error("Analysis failed:", error);
      toast.error(backendError, { id: toastId });

      onUpdateRecord({
        ...currentRecord,
        status: "Failed",
        statusReason: backendError,
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleReanalyze = async (id: string) => {
    const currentRecord = data.find((row) => row.id === id);
    if (!currentRecord) return;

    setAnalyzingId(id);
    onUpdateRecord({
      ...currentRecord,
      status: "Pending",
      statusReason: "Re-queued for fresh AI analysis...",
      sentiment: null,
      score: null,
      openingStatus: null,
      tone: null,
      energyLevel: null,
      activeListening: null,
      summary: null,
      coachingFeedback: null,
      result: null,
    });

    const toastId = toast.loading(
      "Re-queuing this call for fresh AI analysis...",
    );

    try {
      const response = await fetch(`${getApiBaseUrl()}/analysis/reanalyze/${id}`, {
        method: "POST",
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || result?.message || "Failed to start reanalysis",
        );
      }

      if (result.analysis) {
        onUpdateRecord(result.analysis);
      }

      toast.success("Reanalysis job successfully queued.", { id: toastId });

      if (onRefetch) {
        await onRefetch();
      }
      window.dispatchEvent(new CustomEvent("refetch-analysis"));
    } catch (error: any) {
      console.error("Reanalysis failed:", error);
      toast.error(error.message || "Failed to start reanalysis.", {
        id: toastId,
      });
      onUpdateRecord(currentRecord);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleDownloadTranscript = (record: AnalysisRecord) => {
    if (!record.transcription) {
      toast.error("No transcription is available for this call.");
      return;
    }

    const blob = new Blob(
      [
        "QAMS AI CALL TRANSCRIPTION REPORT\n",
        "=================================\n",
        `Record ID: ${record.id}\n`,
        `Agent ID: ${record.agentId || "—"}\n`,
        `Language: ${record.language || "—"}\n`,
        `AI Score: ${record.score !== null ? `${record.score}%` : "—"}\n`,
        `Sentiment: ${record.sentiment || "—"}\n`,
        `Created At: ${record.createdAt}\n`,
        "=================================\n\n",
        record.transcription,
      ],
      { type: "text/plain;charset=utf-8" },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `call_transcript_${record.id}.txt`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded successfully.");
  };

  const handleOpenFullAIReport = async (record: AnalysisRecord) => {
    const toastId = toast.loading(
      `Generating full AI PDF report for Call #${record.id}...`,
    );

    try {
      const url = `${getApiBaseUrl()}/analysis/export?format=pdf&search=${record.id}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to generate PDF report");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `ai_report_${record.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      toast.success("Full AI report downloaded successfully.", { id: toastId });
    } catch (error) {
      console.error("Failed to generate AI report:", error);
      toast.error("Failed to download the full AI PDF report.", {
        id: toastId,
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(dateString));
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <div className="w-full overflow-hidden rounded-xl border border-border bg-surface shadow-elev-1">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-bg-muted/50">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">
                  Agent Name
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Language
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Sentiment
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Score
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">
                  Opening Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Tone
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">
                  Energy Level
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">
                  Active Listening
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">
                  Created Date
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-fg-subtle whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data
                ?.filter((item) => item?.id)
                .map((item) => {
                  const isInProgress = !["Completed", "Failed"].includes(
                    item.status || "",
                  );
                  const displayField = (
                    value: string | null | undefined,
                    processingFallback = "Processing...",
                  ) => {
                    if (value) return value;
                    if (isInProgress) return processingFallback;
                    return "—";
                  };

                  return (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-bg-muted/30"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-fg">
                          {item.agentId || "UNASSIGNED"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                            item.language
                              ? "border-accent/20 bg-accent/15 text-accent"
                              : isInProgress
                                ? "border-info/20 bg-info/10 text-info animate-pulse"
                                : "border-border bg-bg-muted text-fg-subtle",
                          )}
                        >
                          {item.language || (isInProgress ? "Detecting..." : "—")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "block max-w-[150px] truncate text-sm",
                            isInProgress ? "text-info italic" : "text-fg",
                          )}
                          title={item.sentiment || ""}
                        >
                          {displayField(item.sentiment)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.score !== null ? (
                          <span
                            className={cn(
                              "text-sm font-bold",
                              item.score >= 80
                                ? "text-success"
                                : item.score >= 60
                                  ? "text-warning"
                                  : "text-danger",
                            )}
                          >
                            {item.score}%
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "text-sm",
                              isInProgress
                                ? "text-info italic"
                                : "text-fg-subtle",
                            )}
                          >
                            {isInProgress ? "Calculating..." : "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "block max-w-[150px] truncate text-sm",
                            isInProgress ? "text-info italic" : "text-fg",
                          )}
                          title={item.openingStatus || ""}
                        >
                          {displayField(item.openingStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "block max-w-[150px] truncate text-sm",
                            isInProgress ? "text-info italic" : "text-fg",
                          )}
                          title={item.tone || ""}
                        >
                          {displayField(item.tone)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "block max-w-[150px] truncate text-sm",
                            isInProgress ? "text-info italic" : "text-fg",
                          )}
                          title={item.energyLevel || ""}
                        >
                          {displayField(item.energyLevel)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "block max-w-[150px] truncate text-sm",
                            isInProgress ? "text-info italic" : "text-fg",
                          )}
                          title={item.activeListening || ""}
                        >
                          {displayField(item.activeListening)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex max-w-[180px] flex-col gap-1">
                          <StatusBadge
                            status={
                              item.status === "Pending" && analyzingId === item.id
                                ? "Processing"
                                : item.status
                            }
                          />
                          <span className="text-[10px] italic leading-tight text-fg-subtle">
                            {item.statusReason ||
                              (item.status === "Pending"
                                ? "Waiting for analysis"
                                : "")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="whitespace-nowrap text-sm text-fg-subtle">
                          {formatDate(item.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1.5 opacity-90 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => handleViewDetails(item)}
                            className="rounded-md p-1.5 text-fg-subtle transition-all hover:bg-bg-muted hover:text-accent"
                            title="View Details"
                          >
                            <FileText className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleReanalyze(item.id)}
                            disabled={analyzingId === item.id || isInProgress}
                            className="rounded-md p-1.5 text-fg-subtle transition-all hover:bg-bg-muted hover:text-accent disabled:opacity-30"
                            title="Reanalyze Call"
                          >
                            <RefreshCw
                              className={cn(
                                "h-4 w-4",
                                analyzingId === item.id && "animate-spin",
                              )}
                            />
                          </button>

                          <button
                            onClick={() => handleDownloadTranscript(item)}
                            disabled={!item.transcription}
                            className="rounded-md p-1.5 text-fg-subtle transition-all hover:bg-bg-muted hover:text-accent disabled:opacity-30"
                            title="Download Transcript"
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleOpenFullAIReport(item)}
                            disabled={item.status !== "Completed"}
                            className="rounded-md p-1.5 text-fg-subtle transition-all hover:bg-bg-muted hover:text-accent disabled:opacity-30"
                            title="Open Full AI Report"
                          >
                            <BookOpen className="h-4 w-4" />
                          </button>

                          {(item.status === "Pending" || item.status === "Failed") &&
                            analyzingId !== item.id && (
                              <button
                                onClick={() => handleAnalyze(item.id)}
                                className="rounded-md bg-accent/10 p-1.5 text-accent shadow-sm transition-all hover:bg-accent hover:text-white"
                                title="Start AI Analysis"
                              >
                                <Play className="h-4 w-4 fill-current" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
