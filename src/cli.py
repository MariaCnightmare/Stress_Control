import argparse
import json
import os
from datetime import datetime

from stress_control.analyzer import collect_report

BASE_DEFAULTS = {
    "cpu_threshold": 50.0,
    "mem_threshold": 10.0,
    "samples": 3,
    "interval": 0.5,
}

PRESETS = {
    "dev": {"cpu_threshold": 45.0, "mem_threshold": 12.0, "samples": 4, "interval": 0.5},
    "meeting": {"cpu_threshold": 35.0, "mem_threshold": 12.0, "samples": 5, "interval": 0.7},
    "game": {"cpu_threshold": 70.0, "mem_threshold": 15.0, "samples": 3, "interval": 0.5},
}

def _latest_report_path(report_dir):
    try:
        names = [n for n in os.listdir(report_dir) if n.startswith("report_") and n.endswith(".json")]
    except FileNotFoundError:
        return None
    if not names:
        return None
    names.sort()
    return os.path.join(report_dir, names[-1])

def _direction(delta, eps=0.1):
    if delta > eps:
        return "up"
    if delta < -eps:
        return "down"
    return "flat"

def _compute_trend(prev_report, curr_report, prev_path):
    prev_sys = prev_report.get("system", {})
    curr_sys = curr_report.get("system", {})
    prev_alerts = prev_report.get("alerts", [])
    curr_alerts = curr_report.get("alerts", [])

    delta_cpu = round(curr_sys.get("cpu_avg", 0.0) - prev_sys.get("cpu_avg", 0.0), 1)
    delta_mem = round(curr_sys.get("mem_avg", 0.0) - prev_sys.get("mem_avg", 0.0), 1)
    delta_score = round(curr_sys.get("stress_score", 0.0) - prev_sys.get("stress_score", 0.0), 1)
    delta_alerts = len(curr_alerts) - len(prev_alerts)

    if delta_score > 0.1 or delta_alerts > 0:
        summary = "悪化"
    elif delta_score < -0.1 and delta_alerts <= 0:
        summary = "改善"
    else:
        summary = "変化なし"

    return {
        "previous_report": os.path.basename(prev_path),
        "delta": {
            "cpu_avg": delta_cpu,
            "mem_avg": delta_mem,
            "stress_score": delta_score,
            "alerts_count": delta_alerts,
        },
        "direction": {
            "cpu_avg": _direction(delta_cpu),
            "mem_avg": _direction(delta_mem),
            "stress_score": _direction(delta_score),
            "alerts_count": "up" if delta_alerts > 0 else ("down" if delta_alerts < 0 else "flat"),
        },
        "summary": summary,
    }

def main():
    parser = argparse.ArgumentParser(description="Stress_Control report generator")
    parser.add_argument(
        "--preset",
        choices=sorted(PRESETS.keys()),
        help="Preset profile (dev/meeting/game). Explicit flags override preset values.",
    )
    parser.add_argument("--cpu-threshold", type=float, default=None, help="CPU threshold per process (%)")
    parser.add_argument("--mem-threshold", type=float, default=None, help="Memory threshold per process (%)")
    parser.add_argument("--samples", type=int, default=None, help="Number of samples")
    parser.add_argument("--interval", type=float, default=None, help="Interval between samples (sec)")
    args = parser.parse_args()

    base = BASE_DEFAULTS.copy()
    if args.preset:
        base.update(PRESETS[args.preset])
    if args.cpu_threshold is not None:
        base["cpu_threshold"] = args.cpu_threshold
    if args.mem_threshold is not None:
        base["mem_threshold"] = args.mem_threshold
    if args.samples is not None:
        base["samples"] = args.samples
    if args.interval is not None:
        base["interval"] = args.interval

    report = collect_report(
        cpu_threshold=base["cpu_threshold"],
        mem_threshold=base["mem_threshold"],
        samples=base["samples"],
        interval=base["interval"],
    )

    report_dir = "reports"
    os.makedirs(report_dir, exist_ok=True)
    prev_path = _latest_report_path(report_dir)
    if prev_path:
        try:
            with open(prev_path, "r", encoding="utf-8") as f:
                prev_report = json.load(f)
            report["trend"] = _compute_trend(prev_report, report, prev_path)
        except (OSError, json.JSONDecodeError):
            pass
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = os.path.join(report_dir, f"report_{ts}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"[OK] wrote: {path}")
    print(
        "system: cpu_avg={}% mem_avg={} score={}".format(
            report["system"]["cpu_avg"],
            report["system"]["mem_avg"],
            report["system"]["stress_score"],
        )
    )
    print(f"alerts: {len(report['alerts'])}")
    if "trend" in report:
        trend = report["trend"]
        delta = trend["delta"]
        print(
            "trend: {} (score {} / alerts {} / cpu {} / mem {})".format(
                trend["summary"],
                delta["stress_score"],
                delta["alerts_count"],
                delta["cpu_avg"],
                delta["mem_avg"],
            )
        )

if __name__ == "__main__":
    main()
