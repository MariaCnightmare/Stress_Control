import argparse
import json
import os
from datetime import datetime

from stress_control.analyzer import collect_report

def main():
    parser = argparse.ArgumentParser(description="Stress_Control report generator")
    parser.add_argument("--cpu-threshold", type=float, default=50.0, help="CPU threshold per process (%)")
    parser.add_argument("--mem-threshold", type=float, default=10.0, help="Memory threshold per process (%)")
    parser.add_argument("--samples", type=int, default=3, help="Number of samples")
    parser.add_argument("--interval", type=float, default=0.5, help="Interval between samples (sec)")
    args = parser.parse_args()

    report = collect_report(
        cpu_threshold=args.cpu_threshold,
        mem_threshold=args.mem_threshold,
        samples=args.samples,
        interval=args.interval,
    )

    os.makedirs("reports", exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = os.path.join("reports", f"report_{ts}.json")
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

if __name__ == "__main__":
    main()
