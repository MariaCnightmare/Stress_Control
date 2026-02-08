import time
from datetime import datetime

import psutil

CPU_THRESHOLD = 50.0
MEM_THRESHOLD = 10.0  # %
SYSTEM_CPU_THRESHOLD = 70.0
SYSTEM_MEM_THRESHOLD = 80.0
SUSTAIN_RATIO = 0.6

def _sample_processes(acc):
    for p in psutil.process_iter(["pid", "name", "username"]):
        try:
            cpu = p.cpu_percent(interval=None)
            mem = p.memory_percent()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

        item = acc.setdefault(
            p.pid,
            {
                "pid": p.pid,
                "name": p.info.get("name"),
                "user": p.info.get("username"),
                "cpu_sum": 0.0,
                "mem_sum": 0.0,
                "cpu_peak": 0.0,
                "mem_peak": 0.0,
                "samples": 0,
                "cpu_over": 0,
                "mem_over": 0,
            },
        )

        item["name"] = p.info.get("name")
        item["user"] = p.info.get("username")
        item["samples"] += 1
        item["cpu_sum"] += cpu
        item["mem_sum"] += mem
        item["cpu_peak"] = max(item["cpu_peak"], cpu)
        item["mem_peak"] = max(item["mem_peak"], mem)
        if cpu > acc["_cpu_threshold"]:
            item["cpu_over"] += 1
        if mem > acc["_mem_threshold"]:
            item["mem_over"] += 1

def _analyze(procs, cpu_threshold, mem_threshold):
    alerts = []
    for p in procs:
        reasons = []
        if p["cpu_over"] / p["samples"] >= SUSTAIN_RATIO:
            reasons.append("CPU高負荷(継続)")
        elif p["cpu"] > cpu_threshold:
            reasons.append("CPU高負荷(平均)")

        if p["mem_over"] / p["samples"] >= SUSTAIN_RATIO:
            reasons.append("メモリ多消費(継続)")
        elif p["mem"] > mem_threshold:
            reasons.append("メモリ多消費(平均)")
        if reasons:
            alerts.append({
                "pid": p["pid"],
                "name": p["name"],
                "user": p["user"],
                "cpu_avg": p["cpu"],
                "mem_avg": p["mem"],
                "cpu_peak": p["cpu_peak"],
                "mem_peak": p["mem_peak"],
                "samples": p["samples"],
                "reasons": reasons,
                "suggestion": suggest(reasons, p),
            })
    return sorted(
        alerts,
        key=lambda x: (x["cpu_avg"], x["mem_avg"], x["cpu_peak"], x["mem_peak"]),
        reverse=True,
    )

def suggest(reasons, proc):
    # 実行はしない。提案のみ。
    if "CPU高負荷(継続)" in reasons and proc["mem"] < 5:
        return "CPU負荷が継続。負荷原因の調査や手動での優先度見直しを検討（自動実行はしない）"
    if "メモリ多消費(継続)" in reasons:
        return "メモリ多消費が継続。長時間なら再起動/設定見直しを検討（自動実行はしない）"
    return "監視継続"

def _finalize_processes(acc):
    procs = []
    for pid, p in acc.items():
        if pid in ("_cpu_threshold", "_mem_threshold"):
            continue
        if p["samples"] == 0:
            continue
        procs.append(
            {
                "pid": p["pid"],
                "name": p["name"],
                "user": p["user"],
                "cpu": round(p["cpu_sum"] / p["samples"], 1),
                "mem": round(p["mem_sum"] / p["samples"], 1),
                "cpu_peak": round(p["cpu_peak"], 1),
                "mem_peak": round(p["mem_peak"], 1),
                "samples": p["samples"],
                "cpu_over": p["cpu_over"],
                "mem_over": p["mem_over"],
            }
        )
    return procs

def _system_alerts(cpu_avg, mem_avg):
    alerts = []
    if cpu_avg >= SYSTEM_CPU_THRESHOLD:
        alerts.append("CPU高負荷(システム平均)")
    if mem_avg >= SYSTEM_MEM_THRESHOLD:
        alerts.append("メモリ高使用率(システム平均)")
    return alerts

def _stress_score(cpu_avg, mem_avg):
    score = cpu_avg * 0.7 + mem_avg * 0.3
    return round(min(score, 100.0), 1)

def collect_report(
    cpu_threshold=CPU_THRESHOLD,
    mem_threshold=MEM_THRESHOLD,
    samples=3,
    interval=0.5,
):
    # cpu_percentは初回0になりがちなのでウォームアップ
    psutil.cpu_percent(interval=None)
    for p in psutil.process_iter():
        try:
            p.cpu_percent(interval=None)
        except Exception:
            pass

    samples = max(int(samples), 1)
    interval = max(float(interval), 0.0)

    acc = {"_cpu_threshold": cpu_threshold, "_mem_threshold": mem_threshold}
    system_cpu = []
    system_mem = []
    started_at = datetime.now()
    for i in range(samples):
        if i > 0 and interval > 0:
            time.sleep(interval)
        system_cpu.append(psutil.cpu_percent(interval=None))
        system_mem.append(psutil.virtual_memory().percent)
        _sample_processes(acc)

    procs = _finalize_processes(acc)
    alerts = _analyze(procs, cpu_threshold, mem_threshold)
    cpu_avg = round(sum(system_cpu) / len(system_cpu), 1)
    mem_avg = round(sum(system_mem) / len(system_mem), 1)

    return {
        "time": datetime.now().isoformat(timespec="seconds"),
        "report_version": "0.2",
        "sampling": {
            "samples": samples,
            "interval_sec": interval,
            "started_at": started_at.isoformat(timespec="seconds"),
        },
        "system": {
            "cpu_avg": cpu_avg,
            "mem_avg": mem_avg,
            "stress_score": _stress_score(cpu_avg, mem_avg),
            "alerts": _system_alerts(cpu_avg, mem_avg),
        },
        "alerts": alerts,
    }
