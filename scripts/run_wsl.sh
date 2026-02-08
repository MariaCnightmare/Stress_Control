#!/usr/bin/env bash
set -euo pipefail

if [ ! -f ".venv/bin/activate" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install -U pip
pip install -e .
stress-control

