import { useEffect, useState } from "react";
import { Phone, CheckCircle, Clock, BarChart3 } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import type { AnalysisRecord } from "@/services/analysis.service";
import { api } from "@/services/api";

const StatsCards = () => {
  const [statsData, setStatsData] = useState({
    totalCalls: 0,
    processedCalls: 0,
    pendingCalls: 0,
    avgAiScore: 0,
  });

  const fetchStats = () => {
    api.get("/analysis/stats")
      .then((res) => {
        if (res.data && res.data.success) {
          setStatsData(res.data.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Poll every 5 seconds for real-time updates
    const intervalId = setInterval(fetchStats, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const total = statsData.totalCalls;
  const completed = statsData.processedCalls;
  const pending = statsData.pendingCalls;
  const avgScore = Math.round(statsData.avgAiScore);


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
      value:       `${avgScore}%`,
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
