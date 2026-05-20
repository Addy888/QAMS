import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import SectionHeader from "@/components/ui/SectionHeader";
import StatsCards from "./components/StatsCards";
import Filters from "./components/Filters";
import AnalysisTable from "./components/AnalysisTable";
import { Download, RefreshCw, Loader2, Upload } from "lucide-react";
import { type AnalysisRecord } from "@/services/analysis.service";
import { toast } from "sonner";
import { getApiBaseUrl } from "@/services/api";

const AnalysisDashboard = () => {
  const [analysisRecords, setAnalysisRecords] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate format
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.mp3', '.wav', '.m4a'].includes(ext)) {
      toast.error("Unsupported file format. Please upload MP3, WAV, or M4A.");
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Uploading call recording: ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Create an optimistic local recording to show "Uploading" state immediately
      const optimisticId = `TEMP-${Date.now()}`;
      const optimisticRecord: AnalysisRecord = {
        id: optimisticId,
        agent: "AGT-TEMP",
        agentId: "Uploading...",
        sentiment: null,
        score: null,
        result: null,
        status: "Uploading",
        statusReason: "Uploading file to server...",
        createdAt: new Date().toISOString(),
      };

      setAnalysisRecords(prev => [optimisticRecord, ...prev]);

      const response = await fetch(`${getApiBaseUrl()}/analysis/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.recording) {
        toast.success("Call recording uploaded successfully! Starting AI pipeline...", { id: toastId });
        // Replace optimistic record with real recording details
        setAnalysisRecords(prev => 
          prev.map(rec => rec.id === optimisticId ? result.recording : rec)
        );
        await fetchAnalysisRecords(true);
      } else {
        throw new Error(result.error || "Failed to save upload");
      }
    } catch (error: any) {
      console.error("[Upload] Error:", error);
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`, { id: toastId });
      await fetchAnalysisRecords(true);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // Filter States
  const [filters, setFilters] = useState({
    search: "",
    agent: "",
    status: "",
    timeRange: "",
    sentiment: "",
    scoreRange: "",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 400);
    return () => clearTimeout(handler);
  }, [filters.search]);

  const fetchAnalysisRecords = useCallback(async (silent = false, currentFilters = filters, searchVal = debouncedSearch) => {
    try {
      if (!silent) setLoading(true);

      const params = new URLSearchParams();
      if (searchVal) params.append("search", searchVal);
      if (currentFilters.agent) params.append("agent", currentFilters.agent);
      if (currentFilters.status) params.append("status", currentFilters.status);
      if (currentFilters.timeRange) params.append("timeRange", currentFilters.timeRange);
      if (currentFilters.sentiment) params.append("sentiment", currentFilters.sentiment);
      
      if (currentFilters.scoreRange === "high") {
        params.append("scoreMin", "80");
      } else if (currentFilters.scoreRange === "medium") {
        params.append("scoreMin", "60");
        params.append("scoreMax", "79");
      } else if (currentFilters.scoreRange === "low") {
        params.append("scoreMax", "59");
      }

      const response = await fetch(`${getApiBaseUrl()}/analysis/recordings?${params.toString()}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const result = await response.json();

      if (result.success) {
        setAnalysisRecords(result.data ?? []);
      }
    } catch (error) {
      console.error("[Dashboard] Fetch error:", error);
      toast.error("Failed to fetch analysis records");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, debouncedSearch]);

  // Trigger search / filters fetch
  useEffect(() => {
    fetchAnalysisRecords(true, filters, debouncedSearch);
  }, [debouncedSearch, filters.agent, filters.status, filters.timeRange, filters.sentiment, filters.scoreRange, fetchAnalysisRecords]);

  // Initial load
  useEffect(() => {
    fetchAnalysisRecords(false);
  }, [fetchAnalysisRecords]);

  // Listen for analysis completion to auto refetch
  useEffect(() => {
    const handleRefetch = () => {
      fetchAnalysisRecords(true); // Silent refresh
    };
    window.addEventListener('refetch-analysis', handleRefetch);
    return () => {
      window.removeEventListener('refetch-analysis', handleRefetch);
    };
  }, [fetchAnalysisRecords]);

  // Auto-poll every 8s whenever any row is still Processing or Pending (to keep stats/dashboard accurate)
  useEffect(() => {
    const hasActiveJobs = analysisRecords.some((r) => 
      r.status === "Pending" || 
      r.status === "Processing" || 
      r.status === "Retrying" ||
      r.status === "Uploading" ||
      r.status === "Processing Audio" ||
      r.status === "Generating Transcript" ||
      r.status === "Running AI Analysis"
    );

    if (hasActiveJobs) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(() => {
          fetchAnalysisRecords(true); // silent refresh
        }, 8000);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [analysisRecords, fetchAnalysisRecords]);

  // Handle manual sync trigger
  const handleSyncData = async () => {
    setSyncing(true);
    const toastId = toast.loading("Syncing latest calls and launching pending AI jobs...");
    try {
      const response = await fetch(`${getApiBaseUrl()}/analysis/sync`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Sync failed");
      const result = await response.json();
      
      toast.success(result.message || "Dashboard successfully synchronized!", { id: toastId });
      await fetchAnalysisRecords(false);
    } catch (error) {
      console.error("[Dashboard] Sync error:", error);
      toast.error("Failed to synchronize analysis data.", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  // Handle downloads for different formats
  const handleExportReport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(format);
    const toastId = toast.loading(`Generating downloadable ${format.toUpperCase()} report...`);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (filters.agent) params.append("agent", filters.agent);
      if (filters.status) params.append("status", filters.status);
      if (filters.timeRange) params.append("timeRange", filters.timeRange);
      if (filters.sentiment) params.append("sentiment", filters.sentiment);
      
      if (filters.scoreRange === "high") {
        params.append("scoreMin", "80");
      } else if (filters.scoreRange === "medium") {
        params.append("scoreMin", "60");
        params.append("scoreMax", "79");
      } else if (filters.scoreRange === "low") {
        params.append("scoreMax", "59");
      }
      params.append("format", format);

      const url = `${getApiBaseUrl()}/analysis/export?${params.toString()}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Export failed with status: ${response.status}`);
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      
      const extension = format === "excel" ? "xlsx" : format;
      link.setAttribute("download", `qams_analysis_report_${Date.now()}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`Successfully exported ${format.toUpperCase()} report!`, { id: toastId });
    } catch (error) {
      console.error("[Dashboard] Export error:", error);
      toast.error(`Failed to export ${format.toUpperCase()} report.`, { id: toastId });
    } finally {
      setExporting(null);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    fetchAnalysisRecords(false);
  };

  // UPDATE A SINGLE ROW
  const handleUpdateRecord = useCallback((updatedRecord: AnalysisRecord) => {
    setAnalysisRecords((prev) =>
      prev.map((rec) => (rec.id === updatedRecord.id ? updatedRecord : rec))
    );
  }, []);

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 animate-in fade-in duration-500">
      <SectionHeader
        title="AI Analysis Dashboard"
        description="Monitor agent performance and call sentiment analysis in real-time."
        size="lg"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors cursor-pointer shadow-elev-1 disabled:opacity-50">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : "Upload Recording"}
              <input
                type="file"
                accept=".mp3,.wav,.m4a"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>

            <button
              onClick={handleSyncData}
              disabled={syncing || loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-sm font-medium text-fg hover:bg-bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync Data"}
            </button>
            
            <button
              onClick={() => handleExportReport("pdf")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF
            </button>

            <button
              onClick={() => handleExportReport("csv")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-sm font-medium text-fg hover:bg-bg-muted transition-colors disabled:opacity-50"
            >
              {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export CSV
            </button>

            <button
              onClick={() => handleExportReport("excel")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-sm font-medium text-fg hover:bg-bg-muted transition-colors disabled:opacity-50"
            >
              {exporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Excel
            </button>
          </div>
        }
      />

      <div className="space-y-8">
        <section>
          <StatsCards data={analysisRecords} />
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Analysis Records"
            description="Detailed breakdown of all processed call logs."
            size="sm"
          />
          <Filters
            filters={filters}
            onChange={handleFilterChange}
            onApply={handleApplyFilters}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-xl border border-border shadow-elev-1">
              <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
              <p className="text-fg-subtle">Fetching analysis records...</p>
            </div>
          ) : analysisRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-xl border border-border shadow-elev-1">
              <p className="text-fg-subtle">No recordings found matching the filters. Upload a call recording to get started.</p>
            </div>
          ) : (
            <AnalysisTable
              data={analysisRecords}
              onUpdateRecord={handleUpdateRecord}
              onRefetch={() => fetchAnalysisRecords(true)}
            />
          )}
        </section>
      </div>
    </div>
  );
};

export default AnalysisDashboard;