export type Report = {
  time: string;
  report_version: string;
  sampling: {
    samples: number;
    interval_sec: number;
    method: string;
    started_at?: string;
  };
  host?: {
    hostname?: string | null;
    os?: string;
    os_version?: string;
    cpu_model?: string | null;
    cpu_cores?: number | null;
    memory_total?: number;
    is_wsl?: boolean;
  };
  system: {
    cpu_avg: number;
    mem_avg: number;
    stress_score: number;
    alerts: string[];
  };
  top_processes?: Array<{
    pid: number;
    name: string;
    user: string | null;
    cpu_avg: number;
    cpu_peak: number;
    mem_avg: number;
    mem_peak: number;
    samples: number;
  }>;
  alerts: Array<{
    pid: number;
    name: string;
    user: string | null;
    cpu_avg: number;
    mem_avg: number;
    cpu_peak: number;
    mem_peak: number;
    reasons: string[];
    suggestion: string;
  }>;
  trend?: {
    summary?: string;
  };
};
