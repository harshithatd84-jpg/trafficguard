"""
Train ALL ML models for TrafficGuard AI.
Models: Random Forest, XGBoost, Logistic Regression, SVM,
        Decision Tree, K-Nearest Neighbors, Naive Bayes, Gradient Boosting
Run: python train_model.py
"""
import pandas as pd
import numpy as np
import pickle, os, json, warnings
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import (RandomForestClassifier, GradientBoostingClassifier,
                               AdaBoostClassifier)
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                              f1_score, confusion_matrix)
warnings.filterwarnings('ignore')

try:
    from xgboost import XGBClassifier
    XGB = XGBClassifier(n_estimators=200, max_depth=6, learning_rate=0.1,
                        random_state=42, eval_metric='mlogloss', verbosity=0)
    XGB_NAME = 'XGBoost'
except ImportError:
    XGB = GradientBoostingClassifier(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
    XGB_NAME = 'XGBoost'
    print("ℹ️  XGBoost not found — using GradientBoosting as replacement")

# ─── Load ─────────────────────────────────────────────────────────────────────
df = pd.read_csv('dataset/accidents.csv')
print(f"Dataset: {df.shape}")
print(df['severity'].value_counts())

# ─── Feature Engineering ─────────────────────────────────────────────────────
label_encoders = {}
categorical_cols = ['day_of_week','road_type','weather','vehicle_type',
                    'road_condition','junction_type']

# Extended feature set
extra_cols = []
for col in ['month','is_weekend','vehicle_age','speed_limit',
            'driver_distracted','pedestrians_involved',
            'temperature','humidity','road_width']:
    if col in df.columns:
        extra_cols.append(col)

for col in categorical_cols:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col])
    label_encoders[col] = le

target_le = LabelEncoder()
df['severity_encoded'] = target_le.fit_transform(df['severity'])
label_encoders['severity'] = target_le

base_features = ['hour','day_of_week','is_peak_hour','road_type','weather',
                 'traffic_density','speed','vehicle_type','vehicles_involved',
                 'road_condition','alcohol_involved','visibility','junction_type']

feature_cols = base_features + [c for c in extra_cols if c not in base_features]
feature_cols = [c for c in feature_cols if c in df.columns]

print(f"\nFeatures ({len(feature_cols)}): {feature_cols}")

X = df[feature_cols]
y = df['severity_encoded']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

# ─── Models ──────────────────────────────────────────────────────────────────
models_to_train = {
    'Random Forest': (
        RandomForestClassifier(n_estimators=300, max_depth=12, min_samples_split=5,
                               random_state=42, n_jobs=-1), False, 'rf'),
    XGB_NAME: (XGB, False, 'xgb'),
    'Logistic Regression': (
        LogisticRegression(max_iter=2000, C=1.0, random_state=42), True, 'lr'),
    'SVM': (
        SVC(kernel='rbf', C=1.0, probability=True, random_state=42), True, 'svm'),
    'Decision Tree': (
        DecisionTreeClassifier(max_depth=10, min_samples_split=10, random_state=42), False, 'dt'),
    'K-Nearest Neighbors': (
        KNeighborsClassifier(n_neighbors=7, weights='distance', n_jobs=-1), True, 'knn'),
    'Naive Bayes': (
        GaussianNB(), True, 'nb'),
}

results      = {}
best_name    = None
best_acc     = 0
best_model   = None

print("\n" + "="*65)
print(f"{'MODEL':<28} {'ACC':>7} {'F1':>7} {'PREC':>7} {'REC':>7}")
print("="*65)

for name, (clf, use_scaled, short) in models_to_train.items():
    X_tr = X_train_s if use_scaled else X_train
    X_te = X_test_s  if use_scaled else X_test

    clf.fit(X_tr, y_train)
    y_pred = clf.predict(X_te)

    acc  = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    rec  = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    f1   = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    cm   = confusion_matrix(y_test, y_pred).tolist()

    # Cross-val
    cv_scores = cross_val_score(clf, X_tr, y_train, cv=StratifiedKFold(n_splits=5),
                                 scoring='accuracy', n_jobs=-1)

    results[name] = {
        'accuracy':  round(acc*100,2),
        'precision': round(prec*100,2),
        'recall':    round(rec*100,2),
        'f1_score':  round(f1*100,2),
        'confusion_matrix': cm,
        'cv_mean': round(cv_scores.mean()*100,2),
        'cv_std':  round(cv_scores.std()*100,2),
    }

    print(f"{name:<28} {acc*100:>6.2f}% {f1*100:>6.2f}% {prec*100:>6.2f}% {rec*100:>6.2f}%")

    # Save individual model
    os.makedirs('models', exist_ok=True)
    with open(f'models/{short}_model.pkl', 'wb') as f:
        pickle.dump(clf, f)

    if acc > best_acc:
        best_acc   = acc
        best_name  = name
        best_model = clf

print("="*65)
print(f"\n🏆 Best Model: {best_name} ({best_acc*100:.2f}%)")

# Feature importance for tree-based models
if hasattr(best_model, 'feature_importances_'):
    fi = dict(zip(feature_cols, best_model.feature_importances_.tolist()))
    results['feature_importance'] = dict(sorted(fi.items(), key=lambda x:-x[1]))
elif hasattr(best_model, 'coef_'):
    coef = np.abs(best_model.coef_).mean(axis=0)
    fi   = dict(zip(feature_cols, coef.tolist()))
    results['feature_importance'] = dict(sorted(fi.items(), key=lambda x:-x[1]))

# Cross-val summary
results['cross_val_scores'] = {
    name: {"mean": results[name]['cv_mean'], "std": results[name]['cv_std']}
    for name in results if name not in ['feature_importance','best_model','classes','cross_val_scores']
}

# ─── Save ─────────────────────────────────────────────────────────────────────
with open('models/best_model.pkl',     'wb') as f: pickle.dump(best_model, f)
with open('models/scaler.pkl',         'wb') as f: pickle.dump(scaler, f)
with open('models/label_encoders.pkl', 'wb') as f: pickle.dump(label_encoders, f)
with open('models/feature_cols.pkl',   'wb') as f: pickle.dump(feature_cols, f)

results['best_model'] = best_name
results['classes']    = target_le.classes_.tolist()
results['feature_cols'] = feature_cols

with open('models/results.json', 'w') as f:
    json.dump(results, f, indent=2)

print("\n✅ All models saved to models/")
print("▶  Run: python app.py  to start the server")
