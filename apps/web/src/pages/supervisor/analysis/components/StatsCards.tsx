import { useEffect, useState } from "react";
import { Phone, CheckCircle, Clock, BarChart3 } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import type { AnalysisRecord } from "@/services/analysis.service";
import { api } from "@/services/api";

interface StatsCardsProps {
  data?: AnalysisRecord[];
}

const StatsCards = ({ data }: StatsCardsProps) => {
  const [records, setRecords] = useState<AnalysisRecord[]>(data ?? []);

  useEffect(() => {
    if (data) {
      setRecords(data);
    }
  }, [data]);

  useEffect(() => {
    if (!data) {
      api.get("/analysis/recordings")
        .then((res) => {
          if (res.data && res.data.success) setRecords(res.data.data ?? []);
        })
        .catch(() => {});
    }
  }, [data]);

  const total     = records.length;
  const completed = records.filter((r) =>
    r.status === "Completed"
  ).length;
  const pending   = records.filter((r) =>
    r.status === "Pending" ||
    r.status === "Processing" ||
    r.status === "Uploading" ||
    r.status === "Processing Audio" ||
    r.status === "Generating Transcript" ||
    r.status === "Running AI Analysis" ||
    r.status === "Retrying"
  ).length;
  const scores    = records
    .map((r) => r.score)
    .filter((s): s is number => s != null && s > 0);
  const avgScore  = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  const stats = [
    {
      label:       "Total Calls",
      value:       total.toString(),
      icon:        Phone,
      description: "Total recordings in the system",
    },
    {
      label:       "Processed Calls",
      value:       completed.toString(),
      icon:        CheckCircle,
      description: "Successfully analysed by AI",
    },
    {
      label:       "Pending / Processing",
      value:       pending.toString(),
      icon:        Clock,
      description: "Calls in queue for analysis",
    },
    {
      label:       "Avg AI Score",
      value:       scores.length ? `${avgScore}%` : "—",
      icon:        BarChart3,
      description: "Overall quality performance",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          description={stat.description}
        />
      ))}
    </div>
  );
};

export default StatsCards;
