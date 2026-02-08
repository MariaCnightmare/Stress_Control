# Stress_Control Report Schema

## Overview
- 出力は JSON
- 互換性維持のため `report_version` を必須とする
- 追加フィールドは基本的に後方互換（既存フィールドを壊さない）

## Top-level
- report_version: string (例: "1.0")
- time: string (ISO 8601)
- sampling: object
- system: object
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

