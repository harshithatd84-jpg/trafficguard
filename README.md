# 🚦 TrafficGuard AI v2.0

**Full-stack ML web app for predicting traffic accident severity in Bangalore.**

---

## ✨ Features

| Category | Features |
|---|---|
| 🤖 ML | 7 models (RF, XGBoost, LR, SVM, DT, KNN, NaiveBayes), Feature importance, Confusion matrix, Cross-validation |
| 📊 Dashboard | 6+ charts, Severity/hourly/weather/road/alcohol analysis |
| 🗺️ Map | Bangalore accident hotspot interactive map |
| 📋 History | Save predictions, trend chart, filter, export |
| 📤 Upload | Drag & drop CSV, auto-analysis, batch prediction |
| 💾 Export | PDF report, Excel, CSV, JSON export |
| 👤 Auth | Register/Login, profile settings, email alerts |
| 🌐 i18n | 8 languages: EN, Hindi, Kannada, Tamil, Telugu, FR, DE, ES |
| 🎨 Theme | Dark/Light mode toggle |
| 📱 Mobile | Fully responsive sidebar + hamburger menu |

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Generate dataset
```bash
python generate_dataset.py
```

### 3. Train all ML models
```bash
python train_model.py
```

### 4. Start Flask API
```bash
python app.py
```

### 5. Open the frontend
Open `frontend/index.html` in your browser, **or** serve it:
```bash
# Option A: Python simple server (recommended)
cd frontend
python -m http.server 8080
# Then open http://localhost:8080

# Option B: VS Code Live Server
# Right-click frontend/index.html → Open with Live Server
```

---

## 📁 Project Structure

```
trafficguard/
├── app.py                  ← Flask REST API (all endpoints)
├── generate_dataset.py     ← Synthetic dataset generator (8000 records)
├── train_model.py          ← Trains 7 ML models, saves artifacts
├── requirements.txt        ← Python dependencies
├── dataset/
│   └── accidents.csv       ← Generated dataset
├── models/
│   ├── best_model.pkl
│   ├── rf_model.pkl
│   ├── xgb_model.pkl
│   ├── lr_model.pkl
│   ├── svm_model.pkl
│   ├── dt_model.pkl
│   ├── knn_model.pkl
│   ├── nb_model.pkl
│   ├── scaler.pkl
│   ├── label_encoders.pkl
│   ├── feature_cols.pkl
│   └── results.json
├── data/
│   └── app_data.json       ← Users, history (auto-created)
├── uploads/                ← Uploaded CSVs (auto-created)
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── app.js
        └── i18n.js
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API status |
| POST | `/api/predict` | Run severity prediction |
| GET | `/api/dataset-stats` | Dataset statistics |
| GET | `/api/model-metrics` | Model performance data |
| GET | `/api/options` | Dropdown options |
| GET | `/api/history` | Prediction history |
| DELETE | `/api/history/<id>` | Delete one prediction |
| DELETE | `/api/history/clear` | Clear all history |
| GET | `/api/export/csv` | Export history as CSV |
| GET | `/api/export/json` | Export history as JSON |
| POST | `/api/upload` | Upload & analyze CSV |
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/settings` | Update settings |

---

## 🛠️ VS Code Setup

1. Install **Python** extension
2. Install **Live Server** extension (Ritwick Dey)
3. Open folder in VS Code
4. Open terminal: `Ctrl + `` `
5. Run the 4 commands above in order
6. Right-click `frontend/index.html` → **Open with Live Server**

---

## 🔧 Demo Mode

The app works **even without the Flask API running** — it uses:
- Mock data for charts and statistics
- Local browser storage for prediction history
- Demo login (test@example.com / password123)

---

## 📊 ML Models Included

1. **Random Forest** — Usually best performer (~85% accuracy)
2. **XGBoost** — Gradient boosting (~84%)
3. **Logistic Regression** — Linear baseline (~74%)
4. **SVM** — Support Vector Machine (~77%)
5. **Decision Tree** — Interpretable (~79%)
6. **K-Nearest Neighbors** — Instance-based (~77%)
7. **Naive Bayes** — Probabilistic baseline (~68%)

---

## 🌐 Languages

English · हिंदी · ಕನ್ನಡ · தமிழ் · తెలుగు · Français · Deutsch · Español

---

## ⌨️ Keyboard Shortcuts

- `Ctrl + Enter` — Run prediction
- `Esc` — Close modal
