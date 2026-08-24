#!/usr/bin/env python3
"""
TrafficGuard AI — One-click setup
Run: python setup.py
"""
import subprocess, sys, os

def run(cmd, desc):
    print(f"\n{'='*50}\n▶ {desc}\n{'='*50}")
    result = subprocess.run(cmd, shell=True)
    if result.returncode != 0:
        print(f"❌ Failed: {cmd}")
        return False
    return True

print("""
╔══════════════════════════════════════╗
║   TrafficGuard AI v2.0 — Setup       ║
╚══════════════════════════════════════╝
""")

if not run(f"{sys.executable} -m pip install -r requirements.txt", "Installing dependencies"):
    sys.exit(1)

if not os.path.exists('dataset/accidents.csv'):
    run(f"{sys.executable} generate_dataset.py", "Generating dataset")
else:
    print("\n✅ Dataset exists, skipping")

if not os.path.exists('models/best_model.pkl'):
    run(f"{sys.executable} train_model.py", "Training ML models (1–2 minutes...)")
else:
    print("\n✅ Models already trained, skipping")

print("""
╔══════════════════════════════════════╗
║   ✅ Setup Complete!                 ║
╠══════════════════════════════════════╣
║  Next steps:                         ║
║  1. python app.py                    ║
║  2. Open frontend/index.html with    ║
║     Live Server in VS Code           ║
╚══════════════════════════════════════╝
""")
