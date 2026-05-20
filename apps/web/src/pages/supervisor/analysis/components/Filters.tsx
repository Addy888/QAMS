import SearchInput from "@/components/ui/SearchInput";

interface FiltersProps {
  filters: {
    search: string;
    agent: string;
    status: string;
    timeRange: string;
    sentiment: string;
    scoreRange: string;
  };
  onChange: (key: string, value: string) => void;
  onApply: () => void;
}

const Filters = ({ filters, onChange, onApply }: FiltersProps) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-surface p-4 rounded-xl border border-border shadow-elev-1">
      <div className="flex-1 max-w-sm">
        <SearchInput
          placeholder="Search by agent, call ID, transcript..."
          value={filters.search}
          onChange={(e) => onChange("search", e.target.value)}
          onClear={() => onChange("search", "")}
        />
      </div>
      
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filters.agent}
          onChange={(e) => onChange("agent", e.target.value)}
          className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg focus:border-accent focus:outline-none min-w-[140px]"
        >
          <option value="">All Agents</option>
          <option value="AGT-102">Aditya (#AGT-102)</option>
          <option value="AGT-115">Rahul (#AGT-115)</option>
          <option value="AGT-098">Priya (#AGT-098)</option>
          <option value="AGT-221">Amit (#AGT-221)</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => onChange("status", e.target.value)}
          className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg focus:border-accent focus:outline-none min-w-[140px]"
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>

        <select
          value={filters.timeRange}
          onChange={(e) => onChange("timeRange", e.target.value)}
          className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg focus:border-accent focus:outline-none min-w-[120px]"
        >
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7">Last 7 Days</option>
          <option value="last30">Last 30 Days</option>
        </select>

        <select
          value={filters.sentiment}
          onChange={(e) => onChange("sentiment", e.target.value)}
          className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg focus:border-accent focus:outline-none min-w-[140px]"
        >
          <option value="">All Sentiments</option>
          <option value="Positive">Positive</option>
          <option value="Neutral">Neutral</option>
          <option value="Negative">Negative</option>
        </select>

        <select
          value={filters.scoreRange}
          onChange={(e) => onChange("scoreRange", e.target.value)}
          className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg focus:border-accent focus:outline-none min-w-[140px]"
        >
          <option value="">All Scores</option>
          <option value="high">{"High (>=80%)"}</option>
          <option value="medium">{"Medium (60-79%)"}</option>
          <option value="low">{"Low (<60%)"}</option>
        </select>

        <button
          onClick={onApply}
          className="h-9 px-4 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default Filters;
