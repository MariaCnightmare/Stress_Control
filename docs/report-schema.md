# Stress_Control Report Schema

## Overview
- 出力は JSON
- 互換性維持のため `report_version` を必須とする
- 追加フィールドは基本的に後方互換（既存フィールドを壊さない）

## Top-level
- report_version: string (例: "1.0")
- time: string (ISO 8601)
- sampling: object
- host: object
- system: object
- top_processes: array
- alerts: array

## sampling
- samples: int
- interval_sec: number
- method: string (例: "avg/peak/sustain")

## system
- cpu_avg: number (%)
- mem_avg: number (%)
- stress_score: number (0..100)
- alerts: array[string]  (例: "CPU high sustained")

## host
- hostname: string | null
- os: string
- os_version: string
- cpu_model: string | null
- cpu_cores: int | null
- memory_total: number (bytes)
- is_wsl: boolean

## top_processes[] (top consumers)
- pid: int
- name: string
- user: string | null
- cpu_avg: number (%)
- cpu_peak: number (%)
- mem_avg: number (%)
- mem_peak: number (%)
- samples: int

## alerts[] (process alert)
- pid: int
- name: string
- user: string | null
- cpu_avg: number (%)
- cpu_peak: number (%)
- mem_avg: number (%)
- sustain_count: int
- reasons: array[string]
- suggestion: string

## sampling (追加)
- started_at: string (ISO 8601)  ※サンプリング開始時刻（任意だが推奨）

## trend (optional)
前回レポートとの差分。存在しない場合も互換性を壊さない。

- previous_report: string (例: "report_YYYYMMDD-HHMMSS.json")
- delta: object
  - cpu_avg: number
  - mem_avg: number
  - stress_score: number
  - alerts_count: int
- direction: object
  - cpu_avg: "up" | "down" | "flat"
  - mem_avg: "up" | "down" | "flat"
  - stress_score: "up" | "down" | "flat"
  - alerts_count: "up" | "down" | "flat"
- summary: string (例: "悪化" | "改善" | "変化なし")

Note: On multi-core systems, per-process CPU percentage may exceed 100.

## latest.json
- `reports/latest.json` は最新レポートの常時上書き版（UI 監視用）
