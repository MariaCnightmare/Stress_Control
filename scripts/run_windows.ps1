$ErrorActionPreference = "Stop"

if (!(Test-Path ".\.venv\Scripts\Activate.ps1")) {
  python -m venv .venv
}
.\.venv\Scripts\Activate.ps1
python -m pip install -U pip
pip install -e .
stress-control

# UI (Electron HUD)
if (Test-Path ".\\ui\\package.json") {
  Push-Location .\\ui
  if (!(Test-Path ".\\node_modules")) {
    npm install
  }
  Start-Process -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory (Get-Location)
  Pop-Location
}
