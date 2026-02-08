# Platform Notes (Windows / WSL)

## 対象環境
- Primary: Windows 10/11
- Secondary: WSL2 Ubuntu

## 取得指標と注意
### 共通（Windows/WSL）
- CPU 使用率、メモリ使用率、プロセス一覧は psutil で取得可能
- プロセス情報取得は OS・権限により AccessDenied が起こり得る
  - 例外は握りつぶして継続する（観測が止まるのが最悪）

### Windows特有
- 一部プロセスは権限不足で詳細取得不可になりやすい
- 管理者権限の要求は基本しない（安全制約に反するため）

### WSL特有
- /proc 由来の詳細情報で補助できるが、クロスプラットフォーム性を優先して psutil を主軸にする
- WSLのプロセスとWindows側のプロセス境界は文脈に注意（混同しない）
WSL2 は軽量VMのため、WSL内で取得するメモリ使用率やCPU使用率は
「Windows全体」ではなく「WSL環境内」を指す。

Windows全体の負荷を把握したい場合は、Windows側で Stress_Control を実行すること。

## 設計ルール
- psutil を基本依存とする
- OS差分の吸収は analyzer 層で行い、上位（CLI/UI）へ漏らさない

### Windows
- "System Idle Process"(pid 0) は CPU 空き時間を表すため解析対象から除外する。
- 解析ツール自身（stress-control）は自己影響を避けるためデフォルトで除外する。

### WSL
WSL2 で取得する CPU/メモリ使用率は Windows ホスト全体ではなく WSL 環境内を指す。
Windows 全体の負荷把握は Windows 上で stress-control を実行すること。

