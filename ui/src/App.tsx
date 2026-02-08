import { useEffect, useMemo, useState } from "react";
import type { Report } from "./types";

const STATUS = [
  { label: "OK", max: 30 },
  { label: "CAUTION", max: 55 },
  { label: "WARN", max: 75 },
  { label: "DANGER", max: 100 }
];

type Config = {
  showDynamic: boolean;
  showStatic: boolean;
  clickThrough: boolean;
};

type AppInfo = {
  stressControlVersion: string | null;
  uiVersion: string | null;
};

function getStatus(score: number) {
  const entry = STATUS.find((s) => score <= s.max) ?? STATUS[STATUS.length - 1];
  return entry.label;
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "-";
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function formatPct(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${value.toFixed(1)}%`;
}

export default function App() {
  const api = (window as Window).api;
  const [report, setReport] = useState<Report | null>(null);
  const [config, setConfig] = useState<Config>({
    showDynamic: true,
    showStatic: true,
    clickThrough: true
  });
  const [appInfo, setAppInfo] = useState<AppInfo>({
    stressControlVersion: null,
    uiVersion: null
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!api) {
      setApiAvailable(false);
      return;
    }
    api.getConfig().then((cfg) => {
      if (mounted) setConfig(cfg);
    });
    api.getAppInfo().then((info) => {
      if (mounted) setAppInfo(info);
    });
    const unsubscribe = api.onConfigUpdated((cfg) => {
      setConfig(cfg);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [api]);

  useEffect(() => {
    let active = true;
    if (!api) return () => undefined;
    const readOnce = async () => {
      const data = await api.readLatestReport();
      if (!active) return;
      if (data) {
        setReport(data as Report);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    };
    readOnce();
    const timer = setInterval(readOnce, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [api]);

  const score = report?.system?.stress_score ?? 0;
  const status = getStatus(score);
  const pulse = status === "WARN" || status === "DANGER";
  const progress = Math.max(0, Math.min(score, 100)) / 100;

  const ringStyle = useMemo(() => {
    return {
      strokeDasharray: `${Math.round(290 * progress)} 290`
    };
  }, [progress]);

  if (!apiAvailable) {
    return (
      <div className="hud-root">
        <section className="hud-panel static">
          <div className="panel-header">
            <span className="title">HUD ERROR</span>
            <span className="subtitle">preload not available</span>
          </div>
          <div className="section">
            <div className="section-title">Details</div>
            <div className="empty">window.api is undefined. Check preload build and load.</div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`hud-root ${config.clickThrough ? "click-through" : ""}`}>
      {config.showDynamic && (
        <section className={`hud-panel dynamic ${pulse ? "pulse" : ""}`}>
          <div className="panel-header">
            <span className="title">DYNAMIC HUD</span>
            <span className="subtitle">{lastUpdated ? `updated ${lastUpdated}` : "waiting..."}</span>
          </div>

          <div className="ring-block">
            <div className="ring">
              <svg viewBox="0 0 120 120">
                <circle className="ring-outer" cx="60" cy="60" r="46" />
                <circle className="ring-inner" cx="60" cy="60" r="46" style={ringStyle} />
              </svg>
              <div className="ring-center">
                <div className="score">{score.toFixed(1)}</div>
                <div className="status">{status}</div>
              </div>
            </div>
            <div className="system-metrics">
              <div className="metric">
                <span>CPU AVG</span>
                <strong>{formatPct(report?.system?.cpu_avg)}</strong>
              </div>
              <div className="metric">
                <span>MEM AVG</span>
                <strong>{formatPct(report?.system?.mem_avg)}</strong>
              </div>
              {report?.trend?.summary && (
                <div className="metric">
                  <span>TREND</span>
                  <strong>{report.trend.summary}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="section">
            <div className="section-title">Top Processes</div>
            {report?.top_processes?.length ? (
              <ul className="list">
                {report.top_processes.slice(0, 5).map((p) => (
                  <li key={p.pid}>
                    <div className="row">
                      <span className="name">{p.name || "unknown"}</span>
                      <span className="meta">{p.user || "-"} · {p.pid}</span>
                    </div>
                    <div className="row small">
                      <span>CPU {formatPct(p.cpu_avg)} (peak {formatPct(p.cpu_peak)})</span>
                      <span>MEM {formatPct(p.mem_avg)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">No data</div>
            )}
          </div>

          {report?.alerts?.length ? (
            <div className="section">
              <div className="section-title">Alerts</div>
              <ul className="list">
                {report.alerts.slice(0, 3).map((a) => (
                  <li key={a.pid}>
                    <div className="row">
                      <span className="name">{a.name || "unknown"}</span>
                      <span className="meta">{a.pid}</span>
                    </div>
                    <div className="row small">{a.reasons.join(" / ")}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}

      {config.showStatic && (
        <section className="hud-panel static">
          <div className="panel-header">
            <span className="title">STATIC HUD</span>
            <span className="subtitle">read only</span>
          </div>

          <div className="section">
            <div className="section-title">Host</div>
            <div className="kv">
              <span>Hostname</span>
              <strong>{report?.host?.hostname || "-"}</strong>
            </div>
            <div className="kv">
              <span>OS</span>
              <strong>{report?.host?.os ? `${report.host.os} ${report.host.os_version ?? ""}` : "-"}</strong>
            </div>
            <div className="kv">
              <span>CPU</span>
              <strong>
                {report?.host?.cpu_model || "-"} {report?.host?.cpu_cores ? `(${report.host.cpu_cores} cores)` : ""}
              </strong>
            </div>
            <div className="kv">
              <span>Memory</span>
              <strong>{formatBytes(report?.host?.memory_total)}</strong>
            </div>
            <div className="kv">
              <span>WSL</span>
              <strong>{report?.host?.is_wsl ? "Yes" : "No"}</strong>
            </div>
          </div>

          <div className="section">
            <div className="section-title">App</div>
            <div className="kv">
              <span>Stress_Control</span>
              <strong>{appInfo.stressControlVersion || "-"}</strong>
            </div>
            <div className="kv">
              <span>HUD UI</span>
              <strong>{appInfo.uiVersion || "-"}</strong>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
