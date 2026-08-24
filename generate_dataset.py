"""
Generate a synthetic Bangalore traffic accident dataset with extended features.
Run: python generate_dataset.py
"""
import pandas as pd
import numpy as np
import os

np.random.seed(42)
N = 8000  # More records

# ─── Time Features ────────────────────────────────────────────────────────────
hours = np.random.choice(range(0, 24), N, p=[
    0.01,0.01,0.01,0.01,0.01,0.02,
    0.04,0.07,0.08,0.05,0.04,0.04,
    0.05,0.04,0.04,0.04,0.05,0.08,
    0.08,0.07,0.05,0.04,0.04,0.03
])
days   = np.random.choice(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], N)
months = np.random.choice(range(1,13), N)
is_peak= np.where(((hours>=7)&(hours<=10))|((hours>=17)&(hours<=20)),1,0)
is_weekend = np.where(np.isin(days, ['Saturday','Sunday']), 1, 0)

# ─── Location & Road ──────────────────────────────────────────────────────────
road_type = np.random.choice(
    ['Highway','Urban Road','Residential','State Highway','National Highway'], N,
    p=[0.2,0.35,0.2,0.15,0.1])
junction = np.random.choice(
    ['No Junction','T-Junction','Roundabout','Intersection','Y-Junction'], N,
    p=[0.3,0.25,0.1,0.25,0.1])
road_condition = np.random.choice(
    ['Dry','Wet','Slippery','Under Construction','Good'], N,
    p=[0.4,0.25,0.15,0.1,0.1])
road_width = np.clip(np.random.normal(8, 3, N), 3, 20).astype(int)
speed_limit = np.where(np.isin(road_type, ['Highway','National Highway']), 80,
              np.where(road_type == 'State Highway', 60, 40))

# ─── Weather ──────────────────────────────────────────────────────────────────
weather = np.random.choice(['Clear','Rainy','Foggy','Cloudy','Heavy Rain'], N,
                            p=[0.45,0.25,0.10,0.15,0.05])
visibility = np.where(weather=='Foggy', np.random.randint(1,5,N),
             np.where(weather=='Heavy Rain', np.random.randint(2,6,N),
             np.random.randint(5,10,N)))
temperature = np.clip(np.random.normal(28, 6, N), 10, 45).astype(int)
humidity    = np.clip(np.random.normal(65, 20, N), 20, 100).astype(int)

# ─── Traffic & Vehicle ────────────────────────────────────────────────────────
traffic_density = np.clip(
    np.random.normal(5,2,N) + is_peak*2 + is_weekend*(-1), 1, 10).astype(int)
speed = np.clip(
    np.random.normal(50,20,N) - traffic_density*3 + is_peak*(-10), 10, 120).astype(int)
vehicle_type = np.random.choice(
    ['Car','Motorcycle','Truck','Bus','Auto','Bicycle'], N,
    p=[0.35,0.30,0.10,0.10,0.10,0.05])
vehicles_involved = np.random.choice([1,2,3,4,5], N, p=[0.3,0.4,0.15,0.1,0.05])
vehicle_age = np.clip(np.random.normal(6,4,N), 0, 25).astype(int)

# ─── Human Factors ────────────────────────────────────────────────────────────
alcohol    = np.random.choice([0,1], N, p=[0.85,0.15])
distracted = np.random.choice([0,1], N, p=[0.75,0.25])
pedestrians= np.random.choice([0,1,2,3], N, p=[0.55,0.25,0.12,0.08])

# ─── Severity Score ───────────────────────────────────────────────────────────
def compute_severity(idx):
    score = 0
    score += traffic_density[idx] * 0.3
    score += (10 - visibility[idx]) * 0.4
    score += speed[idx] * 0.05
    score += vehicles_involved[idx] * 0.8
    score += alcohol[idx] * 2.5
    score += distracted[idx] * 1.2
    score += pedestrians[idx] * 0.8
    score += 1.5 if weather[idx] in ['Heavy Rain','Foggy'] else 0
    score += 1.0 if road_condition[idx] in ['Slippery','Wet'] else 0
    score += 1.2 if is_peak[idx] == 1 else 0
    score += 1.0 if road_type[idx] in ['Highway','National Highway'] else 0
    score += 0.5 if junction[idx] in ['Intersection','T-Junction'] else 0
    score += 0.5 if speed[idx] > speed_limit[idx] else 0
    score += np.random.normal(0, 1)
    if score < 6:    return 'Low'
    elif score < 10: return 'Medium'
    else:            return 'High'

print(f"Generating {N} records...")
severity = [compute_severity(i) for i in range(N)]

df = pd.DataFrame({
    'hour':             hours,
    'day_of_week':      days,
    'month':            months,
    'is_peak_hour':     is_peak,
    'is_weekend':       is_weekend,
    'road_type':        road_type,
    'weather':          weather,
    'traffic_density':  traffic_density,
    'speed':            speed,
    'speed_limit':      speed_limit,
    'vehicle_type':     vehicle_type,
    'vehicles_involved':vehicles_involved,
    'vehicle_age':      vehicle_age,
    'road_condition':   road_condition,
    'road_width':       road_width,
    'alcohol_involved': alcohol,
    'driver_distracted':distracted,
    'pedestrians_involved': pedestrians,
    'visibility':       visibility,
    'temperature':      temperature,
    'humidity':         humidity,
    'junction_type':    junction,
    'severity':         severity,
})

os.makedirs('dataset', exist_ok=True)
df.to_csv('dataset/accidents.csv', index=False)
print(f"✅ Dataset saved: dataset/accidents.csv ({len(df)} records)")
print(df['severity'].value_counts())
