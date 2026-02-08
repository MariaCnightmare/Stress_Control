## 目標の言い方（プロジェクトの芯）

* **Primary:** Windows（PowerShell / Python）
* **Secondary:** WSL Ubuntu（同じPythonコードで動く）
* **禁止:** 管理者権限前提の破壊的操作（自動kill等）

---

## 推奨リポジトリ構成（Windows前提を反映）

```
Stress_Control/
├── README.md
├── docs/
│   ├── design.md
│   └── platform-notes.md
├── src/
│   ├── stress_control/
│   │   ├── __init__.py
│   │   └── analyzer.py
│   └── cli.py
├── scripts/
│   ├── run_windows.ps1
│   └── run_wsl.sh
├── reports/
│   └── .gitkeep
├── .gitignore
├── pyproject.toml
└── LICENSE
```

**ポイント**

* `src/` 配下に寄せる（将来 `pip install -e .` が楽）
* `scripts/` に Windows/WSL の起動導線を用意（迷子防止）
* `docs/platform-notes.md` で OS差分を固定（Codex暴走防止）

---

## README.md（Windows前提版：そのまま使えます）

````md
# Stress_Control

## 概要
Stress_Control は **Windows を主対象**とした、
安全志向の「タスク負荷 / ストレス可視化」ツールです。
WSL(Ubuntu) でも同一コードで動作します。

本ツールは OS を直接操作せず（自動 kill / renice 等は行わず）、
「観測・分析・提案」に限定してユーザーの判断を支援します。

## 対象環境
- Primary: Windows 10/11 + Python 3.10+
- Secondary: WSL2 Ubuntu + Python 3.10+
- 推奨: 仮想環境（venv）

## 設計方針（重要）
- 危険な自動操作は禁止（自動 kill / renice 等）
- ローカル完結
- クロスプラットフォーム（Windows/WSL）
- 人間が最終判断する

## Docs
- [Design Notes](docs/design.md)
- [Platform Notes](docs/platform-notes.md)
- [Report Schema](docs/report-schema.md)


## 機能（v0.1）
- CPU / メモリ使用率の取得
- 高負荷プロセスの抽出（閾値ベース）
- JSON レポート生成（reports/）

## セットアップ

### Windows (PowerShell)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -U pip
pip install -e .
````

### WSL (Ubuntu)

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install -e .
```

## 実行

### Windows

```powershell
.\scripts\run_windows.ps1
```

### WSL

```bash
bash ./scripts/run_wsl.sh
```

## UI (Electron HUD)

`reports/latest.json` を監視して、透明オーバーレイ HUD を表示します。

### UI セットアップ

```powershell
cd ui
npm install
```

### UI 開発起動

```powershell
cd ui
npm run dev
```

### UI ビルド/起動

```powershell
cd ui
npm run build
npm run start
```

### UI 設定

`ui/config.json` に以下の設定が保存され、再起動後も維持されます。

- `showDynamic`: 左上の動的 HUD 表示
- `showStatic`: 右上の静的 HUD 表示
- `clickThrough`: クリック透過（デフォルト ON）

トグルはトレイメニュー必須で、ホットキーも用意しています。

- `Ctrl+Alt+1`: Dynamic HUD
- `Ctrl+Alt+2`: Static HUD
- `Ctrl+Alt+0`: Click Through

## 将来構想

* Web ダッシュボード（ローカルのみ）
* 履歴蓄積と傾向分析（「悪化の兆候」検出）
* 集中モード/放置モード推定
* 視覚表現（粒子UI等）による状態フィードバック

````

---

## docs/design.md（Windows前提の思想を追記）

```md
# Stress_Control - Design Notes

## 基本思想
Stress_Control は「最適化ツール」ではなく **判断支援ツール** である。
OSを直接操作する最適化は文脈を失う危険があるため採用しない。

## ストレスの定義
ストレスとは以下の状態を指す：
- 高負荷状態の継続
- リソース使用の偏り
- 作業状態とシステム状態の乖離

## Windows前提の理由
本ツールの主戦場は Windows である（作業端末の実態に合わせる）。
ただし WSLでも同一コードで動くことを目標にする。

## 禁止事項
- 自動 kill / 自動 renice / 自動タスク停止
- 管理者権限前提の自動変更
- 常駐化（初期はしない。必要なら段階導入）

## 拡張方針
- コアは分析ロジック（src/stress_control）
- UI は後付け（Web/TUI）
- データ構造（レポートJSON）を壊さない
````

---

## docs/platform-notes.md（OS差分の固定点）

```md
# Platform Notes (Windows / WSL)

## 取得可能な指標
- CPU使用率: Windows/WSL とも取得可能
- メモリ使用率: Windows/WSL とも取得可能
- I/Oや詳細: OSや権限で差が出る（AccessDenied等）

## 注意
- Windowsではプロセス情報取得で AccessDenied が起こり得る
  → 例外を握りつぶして継続すること
- WSLでは Linux の /proc を読む方式も可能だが、
  クロスプラットフォーム優先で psutil を使う

## 依存
- psutil を基本とする（クロスプラットフォーム）
```
