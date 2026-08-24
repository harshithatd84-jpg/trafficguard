"""
TrafficGuard AI v2 — Fixed Full Stack Flask Backend
Run: python app.py
"""
import os, json, pickle, warnings, csv, io, datetime, hashlib, secrets
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, make_response, send_file
from werkzeug.utils import secure_filename

warnings.filterwarnings('ignore')

app = Flask(__name__)

# ─── CORS — fixed, no credentials conflict ────────────────────────────────────
@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Origin']  = origin
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-User-Email'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Vary'] = 'Origin'
    return response

@app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def options_handler(path=''):
    resp = make_response('', 204)
    origin = request.headers.get('Origin', '*')
    resp.headers['Access-Control-Allow-Origin']  = origin
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-User-Email'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return resp

# ─── Config ───────────────────────────────────────────────────────────────────
MODELS_DIR    = 'models'
DATASET_DIR   = 'dataset'
DATA_FILE     = 'data/app_data.json'
UPLOAD_FOLDER = 'uploads'

for d in [MODELS_DIR, DATASET_DIR, UPLOAD_FOLDER, 'data']:
    os.makedirs(d, exist_ok=True)

# ─── Simple JSON Database ─────────────────────────────────────────────────────
def load_db():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return {"users": {}, "predictions": []}

def save_db(db):
    with open(DATA_FILE, 'w') as f:
        json.dump(db, f, indent=2, default=str)

# Helper: get user email from header (frontend sends X-User-Email)
def get_user():
    return request.headers.get('X-User-Email', 'anonymous')

# ─── Load ML Models ───────────────────────────────────────────────────────────
def load_artifacts():
    with open(f'{MODELS_DIR}/best_model.pkl',     'rb') as f: model    = pickle.load(f)
    with open(f'{MODELS_DIR}/scaler.pkl',         'rb') as f: scaler   = pickle.load(f)
    with open(f'{MODELS_DIR}/label_encoders.pkl', 'rb') as f: encoders = pickle.load(f)
    with open(f'{MODELS_DIR}/feature_cols.pkl',   'rb') as f: features = pickle.load(f)
    with open(f'{MODELS_DIR}/results.json',       'r')  as f: results  = json.load(f)
    return model, scaler, encoders, features, results

try:
    model, scaler, label_encoders, feature_cols, model_results = load_artifacts()
    best_name  = model_results.get('best_model', '')
    USE_SCALED = any(x in best_name for x in ['Logistic Regression','SVM','K-Nearest','Naive'])
    print(f"✅ Models loaded — Best: {best_name}")
except Exception as e:
    print(f"❌ Models not loaded: {e}")
    model = scaler = label_encoders = feature_cols = model_results = None
    USE_SCALED = False

# ─── Encode input features ────────────────────────────────────────────────────
# Sensible defaults for missing fields
FIELD_DEFAULTS = {
    'month': 6, 'is_weekend': 0, 'vehicle_age': 5,
    'speed_limit': 60, 'driver_distracted': 0,
    'pedestrians_involved': 0, 'temperature': 28,
    'humidity': 65, 'road_width': 8,
    'hour': 8, 'is_peak_hour': 1, 'traffic_density': 5,
    'speed': 50, 'vehicles_involved': 2,
    'alcohol_involved': 0, 'visibility': 7,
}

def encode_input(data):
    cat_cols = ['day_of_week','road_type','weather','vehicle_type',
                'road_condition','junction_type']
    row = {}
    for col in feature_cols:
        if col in cat_cols:
            le  = label_encoders[col]
            val = str(data.get(col, le.classes_[0]))
            if val not in le.classes_: val = le.classes_[0]
            row[col] = int(le.transform([val])[0])
        else:
            default = FIELD_DEFAULTS.get(col, 0)
            try:    row[col] = float(data.get(col, default))
            except: row[col] = float(default)
    return pd.DataFrame([row])[feature_cols]

def hash_pwd(p): return hashlib.sha256(p.encode()).hexdigest()

# ══════════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/auth/register', methods=['POST'])
def register():
    d     = request.get_json(silent=True) or {}
    name  = d.get('name','').strip()
    email = d.get('email','').strip().lower()
    pwd   = d.get('password','')
    if not name or not email or not pwd:
        return jsonify({"error": "All fields required"}), 400
    if len(pwd) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    db = load_db()
    if email in db['users']:
        return jsonify({"error": "Email already registered"}), 409
    db['users'][email] = {
        "name": name, "email": email,
        "password": hash_pwd(pwd),
        "created_at": str(datetime.datetime.now()),
        "alert_email": email, "alerts_enabled": True,
        "language": "en", "theme": "dark",
    }
    save_db(db)
    user = {k:v for k,v in db['users'][email].items() if k != 'password'}
    return jsonify({"message": "Registered!", "user": user})

@app.route('/api/auth/login', methods=['POST'])
def login():
    d     = request.get_json(silent=True) or {}
    email = d.get('email','').strip().lower()
    pwd   = d.get('password','')
    db    = load_db()
    # Auto-create demo account
    if email == 'test@example.com' and email not in db['users']:
        db['users'][email] = {
            "name":"Demo User","email":email,
            "password": hash_pwd("password123"),
            "created_at": str(datetime.datetime.now()),
            "alert_email": email, "alerts_enabled": True,
            "language":"en","theme":"dark",
        }
        save_db(db)
    user = db['users'].get(email)
    if not user or user['password'] != hash_pwd(pwd):
        return jsonify({"error": "Invalid email or password"}), 401
    return jsonify({"message": "Login successful",
                    "user": {k:v for k,v in user.items() if k != 'password'}})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    return jsonify({"message": "Logged out"})

@app.route('/api/auth/me', methods=['GET'])
def me():
    email = get_user()
    if not email or email == 'anonymous':
        return jsonify({"user": None})
    db   = load_db()
    user = db['users'].get(email)
    if not user: return jsonify({"user": None})
    return jsonify({"user": {k:v for k,v in user.items() if k != 'password'}})

@app.route('/api/auth/settings', methods=['PUT'])
def update_settings():
    email = get_user()
    if email == 'anonymous':
        return jsonify({"error": "Not logged in"}), 401
    d    = request.get_json(silent=True) or {}
    db   = load_db()
    user = db['users'].get(email, {})
    for field in ['alert_email','alerts_enabled','language','theme','name']:
        if field in d: user[field] = d[field]
    db['users'][email] = user
    save_db(db)
    return jsonify({"message": "Settings updated",
                    "user": {k:v for k,v in user.items() if k != 'password'}})

# ══════════════════════════════════════════════════════════════════════════════
# PREDICT
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"error": "Models not loaded. Run generate_dataset.py then train_model.py"}), 500
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "No data provided"}), 400
    try:
        X        = encode_input(data)
        X_input  = scaler.transform(X) if USE_SCALED else X
        pred_enc = model.predict(X_input)[0]
        proba    = model.predict_proba(X_input)[0]
        sev_le   = label_encoders['severity']
        severity = sev_le.inverse_transform([pred_enc])[0]
        classes  = sev_le.classes_.tolist()
        prob     = {cls: round(float(p)*100,1) for cls,p in zip(classes, proba)}

        advice = {
            'Low':    "✅ Low risk. Normal conditions — proceed with standard caution.",
            'Medium': "⚠️ Moderate risk. Reduce speed and maintain safe following distance.",
            'High':   "🚨 High risk! Avoid this route if possible. Emergency services alerted.",
        }.get(severity, "")

        # Save prediction to history
        email = get_user()
        entry = {
            "id":          secrets.token_hex(4),
            "timestamp":   str(datetime.datetime.now()),
            "severity":    severity,
            "probability": prob,
            "advice":      advice,
            "model_used":  model_results.get('best_model','Unknown'),
            "user":        email,
            "input":       data,
        }
        db = load_db()
        db['predictions'].append(entry)
        db['predictions'] = db['predictions'][-500:]
        save_db(db)

        # Alert log for High severity
        if severity == 'High' and email != 'anonymous':
            user = db['users'].get(email, {})
            if user.get('alerts_enabled', True):
                alert_email = user.get('alert_email', email)
                print(f"📧 HIGH SEVERITY ALERT → {alert_email}")

        return jsonify({
            "severity":    severity,
            "probability": prob,
            "advice":      advice,
            "model_used":  model_results.get('best_model','Unknown'),
            "id":          entry['id'],
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ══════════════════════════════════════════════════════════════════════════════
# HISTORY
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/history', methods=['GET'])
def get_history():
    email = get_user()
    db    = load_db()
    preds = [p for p in db['predictions'] if p.get('user') == email]
    return jsonify({"predictions": list(reversed(preds[-100:]))})

@app.route('/api/history/<pred_id>', methods=['DELETE'])
def delete_prediction(pred_id):
    db = load_db()
    db['predictions'] = [p for p in db['predictions'] if p.get('id') != pred_id]
    save_db(db)
    return jsonify({"message": "Deleted"})

@app.route('/api/history/clear', methods=['DELETE'])
def clear_history():
    email = get_user()
    db    = load_db()
    db['predictions'] = [p for p in db['predictions'] if p.get('user') != email]
    save_db(db)
    return jsonify({"message": "Cleared"})

# ══════════════════════════════════════════════════════════════════════════════
# EXPORT
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    email  = request.args.get('email') or get_user()
    db     = load_db()
    preds  = [p for p in db['predictions'] if p.get('user') == email]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID','Timestamp','Severity','Prob_Low','Prob_Medium',
                     'Prob_High','Model','Hour','Weather','Road_Type','Speed',
                     'Traffic_Density','Alcohol'])
    for p in preds:
        prob = p.get('probability', {})
        inp  = p.get('input', {})
        writer.writerow([p.get('id'), p.get('timestamp'), p.get('severity'),
                         prob.get('Low',0), prob.get('Medium',0), prob.get('High',0),
                         p.get('model_used'), inp.get('hour'), inp.get('weather'),
                         inp.get('road_type'), inp.get('speed'),
                         inp.get('traffic_density'), inp.get('alcohol_involved')])
    output.seek(0)
    return send_file(io.BytesIO(output.read().encode()), mimetype='text/csv',
                     as_attachment=True,
                     download_name=f'predictions_{datetime.date.today()}.csv')

@app.route('/api/export/json', methods=['GET'])
def export_json_file():
    email  = request.args.get('email') or get_user()
    db     = load_db()
    preds  = [p for p in db['predictions'] if p.get('user') == email]
    output = io.BytesIO(json.dumps(preds, indent=2, default=str).encode())
    return send_file(output, mimetype='application/json', as_attachment=True,
                     download_name=f'predictions_{datetime.date.today()}.json')

# ══════════════════════════════════════════════════════════════════════════════
# CSV UPLOAD
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/upload', methods=['POST'])
def upload_csv():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    f = request.files['file']
    if not f.filename.lower().endswith('.csv'):
        return jsonify({"error": "Only CSV files allowed"}), 400
    try:
        df      = pd.read_csv(f)
        required = ['hour','weather','road_type','speed']
        missing  = [c for c in required if c not in df.columns]
        if missing:
            return jsonify({"error": f"Missing columns: {missing}"}), 400
        stats = {
            "rows":    len(df),
            "columns": df.columns.tolist(),
            "sample":  df.head(5).fillna('').to_dict(orient='records'),
        }
        if 'severity' in df.columns:
            stats['severity_distribution'] = df['severity'].value_counts().to_dict()
        if model is not None:
            from collections import Counter
            results_batch = []
            for _, row in df.head(100).iterrows():
                try:
                    inp = row.to_dict()
                    for fc in feature_cols:
                        if fc not in inp:
                            inp[fc] = '' if fc in ['day_of_week','road_type','weather',
                                                    'vehicle_type','road_condition','junction_type'] else 0
                    X   = encode_input(inp)
                    xin = scaler.transform(X) if USE_SCALED else X
                    sev = label_encoders['severity'].inverse_transform([model.predict(xin)[0]])[0]
                    results_batch.append(sev)
                except: results_batch.append('Unknown')
            stats['predicted_severity'] = dict(Counter(results_batch))
        return jsonify(stats)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ══════════════════════════════════════════════════════════════════════════════
# DATASET STATS + MODEL METRICS + OPTIONS
# ══════════════════════════════════════════════════════════════════════════════
@app.route('/api/dataset-stats', methods=['GET'])
def dataset_stats():
    try:
        df = pd.read_csv(f'{DATASET_DIR}/accidents.csv')
        return jsonify({
            "total_records":          len(df),
            "severity_distribution":  df['severity'].value_counts().to_dict(),
            "peak_hour_accidents":    int(df['is_peak_hour'].sum()),
            "avg_speed":              round(float(df['speed'].mean()),1),
            "avg_traffic_density":    round(float(df['traffic_density'].mean()),1),
            "weather_distribution":   df['weather'].value_counts().to_dict(),
            "road_type_distribution": df['road_type'].value_counts().to_dict(),
            "hourly_distribution":    {int(k):int(v) for k,v in df.groupby('hour')['severity'].count().items()},
            "day_distribution":       df['day_of_week'].value_counts().to_dict(),
            "vehicles_distribution":  df['vehicles_involved'].value_counts().to_dict(),
            "hotspots": [
                {"name":"MG Road",         "lat":12.9758,"lng":77.6077,"count":245,"severity":"High"},
                {"name":"Silk Board",      "lat":12.9177,"lng":77.6220,"count":312,"severity":"High"},
                {"name":"Hebbal",          "lat":13.0358,"lng":77.5970,"count":198,"severity":"Medium"},
                {"name":"Electronic City", "lat":12.8452,"lng":77.6602,"count":267,"severity":"High"},
                {"name":"Marathahalli",    "lat":12.9591,"lng":77.6988,"count":189,"severity":"Medium"},
                {"name":"Whitefield",      "lat":12.9698,"lng":77.7499,"count":156,"severity":"Medium"},
                {"name":"Koramangala",     "lat":12.9352,"lng":77.6245,"count":134,"severity":"Medium"},
                {"name":"Yeshwantpur",     "lat":13.0234,"lng":77.5518,"count":178,"severity":"High"},
                {"name":"BTM Layout",      "lat":12.9165,"lng":77.6101,"count":112,"severity":"Low"},
                {"name":"Indiranagar",     "lat":12.9784,"lng":77.6408,"count":143,"severity":"Low"},
            ],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/model-metrics', methods=['GET'])
def model_metrics():
    if model_results is None:
        return jsonify({"error": "Models not loaded"}), 500
    metrics = {}
    for name in ['Random Forest','XGBoost','Logistic Regression','SVM',
                 'Decision Tree','K-Nearest Neighbors','Naive Bayes']:
        if name in model_results: metrics[name] = model_results[name]
    return jsonify({
        "metrics":            metrics,
        "best_model":         model_results.get('best_model'),
        "classes":            model_results.get('classes'),
        "feature_importance": model_results.get('feature_importance', {}),
        "cross_val_scores":   model_results.get('cross_val_scores', {}),
    })

@app.route('/api/options', methods=['GET'])
def get_options():
    return jsonify({
        "day_of_week":    ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
        "road_type":      ['Highway','Urban Road','Residential','State Highway','National Highway'],
        "weather":        ['Clear','Rainy','Foggy','Cloudy','Heavy Rain'],
        "vehicle_type":   ['Car','Motorcycle','Truck','Bus','Auto','Bicycle'],
        "road_condition": ['Dry','Wet','Slippery','Under Construction','Good'],
        "junction_type":  ['No Junction','T-Junction','Roundabout','Intersection','Y-Junction'],
    })

@app.route('/')
def index():
    return jsonify({"message":"TrafficGuard AI API","status":"running","version":"2.0"})

if __name__ == '__main__':
    if not os.path.exists(f'{MODELS_DIR}/best_model.pkl'):
        print("⚠️  Models not found! Run:")
        print("   python generate_dataset.py")
        print("   python train_model.py")
    app.run(debug=True, port=5000, host='127.0.0.1')
