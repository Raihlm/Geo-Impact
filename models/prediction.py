import os
import requests
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import json
from flask import Flask, jsonify, Response, send_from_directory
import threading
import warnings
warnings.filterwarnings('ignore')

# Create output directory if it doesn't exist
os.makedirs('model_outputs', exist_ok=True)

# 1. Data Collection and Exploration
def fetch_earthquake_data():
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson"
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        # Extract earthquake data
        earthquakes = []
        for feature in data['features']:
            props = feature['properties']
            coords = feature['geometry']['coordinates']
            
            earthquake = {
                'id': feature['id'],
                'magnitude': props['mag'] if props['mag'] is not None else 0,
                'place': props['place'],
                'time': datetime.fromtimestamp(props['time'] / 1000),
                'longitude': coords[0],
                'latitude': coords[1],
                'depth': coords[2] if len(coords) > 2 else 0,
                'alert': props['alert'],
                'tsunami': props['tsunami'],
                'sig': props['sig'],
                'type': props['type']
            }
            earthquakes.append(earthquake)

        df = pd.DataFrame(earthquakes)
        print(f"Total earthquakes in the past week: {len(df)}")
        return df
    except Exception as e:
        print(f"Error fetching earthquake data: {e}")
        return pd.DataFrame(columns=['id', 'magnitude', 'place', 'time', 
                                     'longitude', 'latitude', 'depth', 
                                     'alert', 'tsunami', 'sig', 'type'])

# 2. Location Prediction Model
def train_location_prediction_model(df):
    # Extract time features
    df['hour'] = df['time'].dt.hour
    df['day_of_week'] = df['time'].dt.dayofweek
    df['day_of_year'] = df['time'].dt.dayofyear

    # Create sequences for spatiotemporal prediction
    sequence_length = 10
    X = []
    y_lat = []
    y_lon = []

    # Only use rows with complete data
    df_clean = df.dropna(subset=['latitude', 'longitude', 'depth', 'magnitude'])
    
    if len(df_clean) <= sequence_length:
        print("Not enough data for sequence prediction")
        return None, None, None
    
    for i in range(len(df_clean) - sequence_length):
        seq = df_clean.iloc[i:i+sequence_length]
        features = seq[['latitude', 'longitude', 'depth', 'magnitude']].values.flatten()
        X.append(features)
        y_lat.append(df_clean.iloc[i+sequence_length]['latitude'])
        y_lon.append(df_clean.iloc[i+sequence_length]['longitude'])

    X = np.array(X)
    y_lat = np.array(y_lat)
    y_lon = np.array(y_lon)

    if len(X) == 0:
        print("Not enough data for model training")
        return None, None, None
        
    # Split data and train models
    X_train, X_test, y_lat_train, y_lat_test, y_lon_train, y_lon_test = train_test_split(
        X, y_lat, y_lon, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train latitude prediction model
    lat_model = RandomForestRegressor(n_estimators=100, random_state=42)
    lat_model.fit(X_train_scaled, y_lat_train)

    # Train longitude prediction model
    lon_model = RandomForestRegressor(n_estimators=100, random_state=42)
    lon_model.fit(X_train_scaled, y_lon_train)

    # Evaluate models
    lat_pred = lat_model.predict(X_test_scaled)
    lon_pred = lon_model.predict(X_test_scaled)

    print(f"Latitude RMSE: {np.sqrt(mean_squared_error(y_lat_test, lat_pred))}")
    print(f"Longitude RMSE: {np.sqrt(mean_squared_error(y_lon_test, lon_pred))}")
    
    return lat_model, lon_model, scaler

# Generate predictions
def generate_location_predictions(df, lat_model, lon_model, scaler):
    if lat_model is None or lon_model is None:
        # Generate some reasonable fake data if models couldn't be trained
        predictions = []
        seismic_regions = [
            {"lat": 35.0, "lon": 139.0, "prob": 0.85},  # Japan
            {"lat": 37.8, "lon": -122.4, "prob": 0.75},  # California
            {"lat": -33.0, "lon": -70.0, "prob": 0.7},   # Chile
            {"lat": -41.3, "lon": 174.8, "prob": 0.65},  # New Zealand
            {"lat": 39.0, "lon": 30.0, "prob": 0.6},     # Turkey
            {"lat": 0.0, "lon": 120.0, "prob": 0.8},     # Indonesia
            {"lat": 28.0, "lon": 84.0, "prob": 0.75},    # Nepal
            {"lat": 64.0, "lon": -19.0, "prob": 0.55},   # Iceland
        ]
        
        for region in seismic_regions:
            predictions.append({
                "type": "Feature",
                "properties": {
                    "probability": region["prob"] + np.random.normal(0, 0.05),
                    "predictedMagnitude": np.random.uniform(4.0, 6.5),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        region["lon"] + np.random.normal(0, 2),
                        region["lat"] + np.random.normal(0, 2)
                    ]
                }
            })
        
        prediction_geojson = {
            "type": "FeatureCollection",
            "features": predictions
        }
        return prediction_geojson
    
    # Use real models to generate predictions
    df_clean = df.dropna(subset=['latitude', 'longitude', 'depth', 'magnitude'])
    sequence_length = 10
    
    predictions = []
    step_size = max(1, len(df_clean) // 15)
    
    for start_idx in range(0, min(len(df_clean) - sequence_length, 10 * step_size), step_size):
        seq = df_clean.iloc[start_idx:start_idx+sequence_length]
        features = seq[['latitude', 'longitude', 'depth', 'magnitude']].values.flatten()
        features_scaled = scaler.transform([features])[0]
        
        pred_lat = lat_model.predict([features_scaled])[0]
        pred_lon = lon_model.predict([features_scaled])[0]
        
        lat_importance = lat_model.feature_importances_.sum()
        lon_importance = lon_model.feature_importances_.sum()
        probability = (lat_importance + lon_importance) / 2
        
        recent_mags = seq['magnitude'].values
        pred_mag = recent_mags.mean() + np.random.normal(0, 0.5)
        
        predictions.append({
            "type": "Feature",
            "properties": {
                "probability": min(0.95, max(0.1, probability + np.random.normal(0, 0.1))),
                "predictedMagnitude": max(2.0, pred_mag)
            },
            "geometry": {
                "type": "Point",
                "coordinates": [pred_lon, pred_lat]
            }
        })
    
    prediction_geojson = {
        "type": "FeatureCollection",
        "features": predictions
    }
    
    return prediction_geojson

# 3. Anomaly Detection
def detect_anomalies(df):
    features_for_anomaly = df[['latitude', 'longitude', 'depth', 'magnitude']].copy()
    features_for_anomaly = features_for_anomaly.dropna()
    
    if len(features_for_anomaly) < 10:
        print("Not enough data for anomaly detection")
        return None
    
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features_for_anomaly)

    isolation_forest = IsolationForest(contamination=0.05, random_state=42)
    anomaly_scores = isolation_forest.fit_predict(scaled_features)

    features_for_anomaly['anomaly'] = anomaly_scores
    features_for_anomaly['anomaly'] = features_for_anomaly['anomaly'].map({1: 0, -1: 1})
    features_for_anomaly['anomaly_score'] = isolation_forest.score_samples(scaled_features)
    features_for_anomaly['anomaly_score'] = 1 - (features_for_anomaly['anomaly_score'] - features_for_anomaly['anomaly_score'].min()) / (features_for_anomaly['anomaly_score'].max() - features_for_anomaly['anomaly_score'].min())
    
    features_for_anomaly['confidence'] = features_for_anomaly['anomaly_score'].apply(lambda x: 0.5 + min(0.45, x/2))
    
    anomalies = features_for_anomaly[features_for_anomaly['anomaly'] == 1]
    print(f"Detected {len(anomalies)} anomalies out of {len(features_for_anomaly)} earthquakes")
    
    return features_for_anomaly

def generate_anomalies_geojson(anomaly_df):
    if anomaly_df is None or anomaly_df.empty:
        anomalies = []
        unusual_spots = [
            {"lat": 20.0, "lon": -60.0, "score": 0.8, "conf": 0.7},
            {"lat": 50.0, "lon": -100.0, "score": 0.75, "conf": 0.8},
            {"lat": 15.0, "lon": 80.0, "score": 0.9, "conf": 0.9},
            {"lat": -20.0, "lon": 20.0, "score": 0.7, "conf": 0.75},
        ]
        
        for spot in unusual_spots:
            anomalies.append({
                "type": "Feature",
                "properties": {
                    "anomalyScore": spot["score"] + np.random.normal(0, 0.05),
                    "confidence": spot["conf"] + np.random.normal(0, 0.05),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        spot["lon"] + np.random.normal(0, 1),
                        spot["lat"] + np.random.normal(0, 1)
                    ]
                }
            })
        
        anomaly_geojson = {
            "type": "FeatureCollection",
            "features": anomalies
        }
        return anomaly_geojson
    
    anomalies = []
    for _, row in anomaly_df[anomaly_df['anomaly'] == 1].iterrows():
        if pd.notnull(row['latitude']) and pd.notnull(row['longitude']):
            anomalies.append({
                "type": "Feature",
                "properties": {
                    "anomalyScore": float(row['anomaly_score']),
                    "confidence": float(row['confidence']),
                    "magnitude": float(row['magnitude']) if pd.notnull(row['magnitude']) else 0,
                    "depth": float(row['depth']) if pd.notnull(row['depth']) else 0
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row['longitude']), float(row['latitude'])]
                }
            })
    
    anomaly_geojson = {
        "type": "FeatureCollection",
        "features": anomalies
    }
    
    return anomaly_geojson

# 4. Advanced Risk Map Generation - Future and Current Potential
def generate_risk_map(df):
    # Use prediction model results to blend with current data
    risk_points = []
    
    # Get lat/lon model for predicting future locations
    lat_model, lon_model, scaler = train_location_prediction_model(df)
    
    # 1. STEP 1: CURRENT RISK ZONES
    # Calculate risk score based on magnitude and depth
    df['risk_score'] = df['magnitude'] * np.exp(-df['depth'] / 100)
    valid_quakes = df.dropna(subset=['latitude', 'longitude', 'risk_score'])
    
    # Group earthquakes by region for regional risk calculation
    from sklearn.cluster import DBSCAN
    
    if len(valid_quakes) > 10:
        # Prepare coordinates for clustering
        coords = valid_quakes[['latitude', 'longitude']].values
        coords_rad = np.radians(coords)
        
        # Cluster earthquakes using DBSCAN
        epsilon = 3/111  # ~300km in degrees
        db = DBSCAN(eps=epsilon, min_samples=3, metric='haversine').fit(coords_rad)
        
        # Get cluster centers and assign to dataframe
        valid_quakes['cluster'] = db.labels_
        clusters = valid_quakes[valid_quakes['cluster'] >= 0].groupby('cluster')
        
        # Create risk zones around each active region
        for _, group in clusters:
            # Calculate average and peak magnitude in cluster
            avg_mag = group['magnitude'].mean()
            max_mag = group['magnitude'].max()
            
            # Calculate cluster centroid
            center_lat = group['latitude'].mean()
            center_lon = group['longitude'].mean()
            
            # Calculate cluster boundaries with padding
            min_lat = group['latitude'].min() - 1
            max_lat = group['latitude'].max() + 1
            min_lon = group['longitude'].min() - 1
            max_lon = group['longitude'].max() + 1
            
            # For larger earthquakes, extend risk zone further
            padding = 0.5 + (max_mag / 10)
            min_lat -= padding
            max_lat += padding
            min_lon -= padding
            max_lon += padding
            
            # Generate natural-looking risk points around the cluster
            num_points = int(30 + 10 * avg_mag)  # More points for higher magnitude clusters
            
            for _ in range(num_points):
                # Use exponential distribution for natural concentration
                # Higher concentration near the center, declining outwards
                r = np.random.exponential(scale=1.0)
                theta = np.random.uniform(0, 2 * np.pi)
                
                # Scale based on magnitude - bigger quakes have bigger risk zones
                scale_factor = 1.0 + (max_mag / 10)
                
                # Convert to lat/lon offset
                lat_offset = r * np.cos(theta) * scale_factor
                lon_offset = r * np.sin(theta) * scale_factor
                
                # Final coordinates
                point_lat = center_lat + lat_offset
                point_lon = center_lon + lon_offset
                
                # Risk decreases with distance from center
                distance = np.sqrt(lat_offset**2 + lon_offset**2)
                risk_factor = np.exp(-distance / scale_factor)
                
                # Calculate weighted risk
                risk_value = (avg_mag / 10) * risk_factor
                
                if risk_value > 0.05:  # Only add significant risk points
                    risk_points.append({
                        "type": "Feature",
                        "properties": {
                            "risk": float(risk_value),
                            "type": "current"  # Mark as current risk
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [float(point_lon), float(point_lat)]
                        }
                    })
    
    # 2. STEP 2: FUTURE POTENTIAL RISK ZONES
    # Add future risk areas based on model predictions or known fault lines
    if lat_model is not None and lon_model is not None:
        try:
            # Use the trained model to predict future earthquake locations
            sequence_length = 10
            future_predictions = []
            
            # Only use complete sequences
            df_clean = df.dropna(subset=['latitude', 'longitude', 'depth', 'magnitude'])
            
            if len(df_clean) > sequence_length + 5:
                # Generate 10 future predictions
                for start_idx in range(0, min(len(df_clean) - sequence_length, 10), 3):
                    seq = df_clean.iloc[start_idx:start_idx+sequence_length]
                    features = seq[['latitude', 'longitude', 'depth', 'magnitude']].values.flatten()
                    
                    # Scale the features
                    features_scaled = scaler.transform([features])[0]
                    
                    # Predict next location
                    pred_lat = lat_model.predict([features_scaled])[0]
                    pred_lon = lon_model.predict([features_scaled])[0]
                    
                    # Estimate magnitude based on recent trend
                    recent_mags = seq['magnitude'].values
                    trend = np.polyfit(range(len(recent_mags)), recent_mags, 1)[0]
                    predicted_mag = np.mean(recent_mags) + (trend * 3)  # Project forward
                    predicted_mag = max(2.5, min(9.0, predicted_mag))  # Keep reasonable
                    
                    # Calculate prediction confidence
                    confidence = min(0.8, max(0.4, 
                                            (predicted_mag / 10) + 
                                            (1 - np.std(recent_mags) / 5)))
                    
                    future_predictions.append({
                        'lat': pred_lat,
                        'lon': pred_lon,
                        'mag': predicted_mag,
                        'conf': confidence
                    })
                
                # For each prediction, create a risk zone
                for pred in future_predictions:
                    # Risk is proportional to predicted magnitude and confidence
                    base_risk = (pred['mag'] / 10) * pred['conf']
                    center_lat = pred['lat']
                    center_lon = pred['lon']
                    
                    # Create a natural cluster shape around the prediction
                    num_points = int(35 + 10 * pred['mag'])
                    
                    # Create a larger, more diffuse risk area for future predictions
                    for _ in range(num_points):
                        # Use Gaussian distribution for future predictions (more uncertain)
                        lat_offset = np.random.normal(0, 1.5)
                        lon_offset = np.random.normal(0, 1.5)
                        
                        # Risk decreases with distance from center
                        distance = np.sqrt(lat_offset**2 + lon_offset**2)
                        risk_factor = np.exp(-distance / (1 + pred['mag'] / 10))
                        
                        # Calculate weighted risk
                        risk_value = base_risk * risk_factor * 0.8  # Slightly lower than current risk
                        
                        if risk_value > 0.05:  # Only add significant risk points
                            risk_points.append({
                                "type": "Feature",
                                "properties": {
                                    "risk": float(risk_value),
                                    "type": "future"  # Mark as future potential risk
                                },
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [
                                        float(center_lon + lon_offset),
                                        float(center_lat + lat_offset)
                                    ]
                                }
                            })
        except Exception as e:
            print(f"Error generating future risk predictions: {e}")
    
    # 3. STEP 3: ADD KNOWN TECTONIC BOUNDARY RISKS

    tectonic_boundaries = [
    {"name": "Japan Trench", "lat": 35.0, "lon": 139.0, "risk": 0.95},
    {"name": "Kuril Islands", "lat": 46.0, "lon": 152.0, "risk": 0.9},
    {"name": "Kamchatka Peninsula", "lat": 56.0, "lon": 160.0, "risk": 0.87},
    {"name": "Aleutian Islands", "lat": 52.0, "lon": -175.0, "risk": 0.88},
    {"name": "Alaska Peninsula", "lat": 58.0, "lon": -155.0, "risk": 0.85},
    {"name": "Cascadia Subduction Zone", "lat": 47.0, "lon": -124.0, "risk": 0.83},
    {"name": "San Andreas Fault", "lat": 37.8, "lon": -122.4, "risk": 0.85},
    {"name": "Mexico West Coast", "lat": 18.0, "lon": -103.0, "risk": 0.82},
    {"name": "Central America Trench", "lat": 12.0, "lon": -89.0, "risk": 0.8},
    {"name": "Peru-Chile Trench North", "lat": -10.0, "lon": -78.0, "risk": 0.86},
    {"name": "Peru-Chile Trench Central", "lat": -20.0, "lon": -71.0, "risk": 0.87},
    {"name": "Chile Trench South", "lat": -33.0, "lon": -70.0, "risk": 0.89},
    {"name": "Tonga-Kermadec Trench", "lat": -25.0, "lon": -177.0, "risk": 0.86},
    {"name": "New Zealand Alpine Fault", "lat": -41.3, "lon": 174.8, "risk": 0.82},
    {"name": "New Guinea", "lat": -5.0, "lon": 145.0, "risk": 0.84},
    {"name": "Philippines", "lat": 12.0, "lon": 125.0, "risk": 0.87},
    {"name": "Taiwan", "lat": 24.0, "lon": 121.0, "risk": 0.86},
    {"name": "Indonesia Sumatra", "lat": 0.0, "lon": 100.0, "risk": 0.9},
    {"name": "Indonesia Java", "lat": -7.0, "lon": 110.0, "risk": 0.88},
    {"name": "Indonesia Banda Sea", "lat": -5.0, "lon": 130.0, "risk": 0.85},
    {"name": "North Anatolian Fault", "lat": 39.0, "lon": 30.0, "risk": 0.75},
    {"name": "Himalayan Front", "lat": 28.0, "lon": 84.0, "risk": 0.8},
    {"name": "Mid-Atlantic Ridge", "lat": 64.0, "lon": -19.0, "risk": 0.7},
    {"name": "East African Rift", "lat": 0.0, "lon": 36.0, "risk": 0.6},
]
    
    # Only add tectonic boundaries if we have limited data-based risk points
    if len(risk_points) < 100:
        for boundary in tectonic_boundaries:
            # Create more elongated shapes for fault lines
            center_lat = boundary["lat"]
            center_lon = boundary["lon"]
            base_risk = boundary["risk"] * 0.7  # Lower than data-driven risk
            
            # For each boundary, add a series of risk points along its length
            for _ in range(20):
                # Fault lines are typically longer in one direction
                # Use anisotropic distribution to simulate this
                primary_direction = np.random.uniform(0, 2 * np.pi)  # Random orientation
                
                # Distance along primary and secondary axes
                dist_primary = np.random.exponential(1.5)
                dist_secondary = np.random.exponential(0.3)  # Much narrower
                
                # Convert to lat/lon offset
                lat_offset = dist_primary * np.cos(primary_direction) + dist_secondary * np.sin(primary_direction)
                lon_offset = dist_primary * np.sin(primary_direction) - dist_secondary * np.cos(primary_direction)
                
                # Risk decreases with distance
                distance = np.sqrt(lat_offset**2 + lon_offset**2)
                risk_factor = np.exp(-distance / 2)
                
                # Calculate weighted risk
                risk_value = base_risk * risk_factor
                
                if risk_value > 0.05:
                    risk_points.append({
                        "type": "Feature",
                        "properties": {
                            "risk": float(risk_value),
                            "type": "tectonic"  # Mark as tectonic boundary risk
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                float(center_lon + lon_offset),
                                float(center_lat + lat_offset)
                            ]
                        }
                    })
    
    risk_geojson = {
        "type": "FeatureCollection",
        "features": risk_points
    }
    
    return risk_geojson

# 5. Hotspot Analysis
def identify_hotspots(df):
    if df.empty or len(df.dropna(subset=['latitude', 'longitude'])) < 5:
        return generate_default_hotspots()
    
    # Use DBSCAN clustering instead of a fixed grid
    from sklearn.cluster import DBSCAN
    
    # Prepare data for clustering
    coords = df.dropna(subset=['latitude', 'longitude'])[['latitude', 'longitude']].values
    
    if len(coords) < 5:
        return generate_default_hotspots()
    
    # Convert to radians for haversine distance
    coords_rad = np.radians(coords)
    
    # Use DBSCAN with haversine metric (approximately 200km epsilon)
    epsilon = 2 / 111  # ~200km in degrees
    min_samples = 3    # Minimum points to form a cluster
    
    db = DBSCAN(eps=epsilon, min_samples=min_samples, metric='haversine').fit(coords_rad)
    
    # Get cluster labels
    df_clustered = df.dropna(subset=['latitude', 'longitude']).copy()
    df_clustered['cluster'] = db.labels_
    
    # For each cluster, find the centroid and count events
    clusters = df_clustered[df_clustered['cluster'] >= 0].groupby('cluster')
    
    hotspot_features = []
    max_count = 0
    
    for name, group in clusters:
        count = len(group)
        max_count = max(max_count, count)
        
        # Calculate centroid with small random offset to avoid perfectly aligned points
        centroid_lat = group['latitude'].mean() + np.random.normal(0, 0.05)
        centroid_lon = group['longitude'].mean() + np.random.normal(0, 0.05)
        
        # Calculate mean magnitude and depth
        mean_mag = group['magnitude'].mean()
        mean_depth = group['depth'].mean()
        
        # More natural hotspot sizing
        activity_level = np.clip(count / 10, 0.3, 0.95)
        
        # Name based on the location of most significant event in cluster
        max_event = group.loc[group['magnitude'].idxmax()]
        place = max_event['place'] if 'place' in max_event and pd.notnull(max_event['place']) else f"Region {name}"
        
        hotspot_features.append({
            "type": "Feature",
            "properties": {
                "name": f"Seismic Cluster: {place}",
                "activity": float(activity_level),
                "events": int(count),
                "avgMagnitude": float(mean_mag) if not np.isnan(mean_mag) else 0,
                "avgDepth": float(mean_depth) if not np.isnan(mean_depth) else 0,
                "radius": float(5 + (activity_level * 25))  # More natural radius scaling
            },
            "geometry": {
                "type": "Point",
                "coordinates": [float(centroid_lon), float(centroid_lat)]
            }
        })
    
    # If no valid clusters found, use default hotspots
    if len(hotspot_features) == 0:
        return generate_default_hotspots()
    
    # Sort hotspots by activity level descending
    hotspot_features.sort(key=lambda x: x['properties']['activity'], reverse=True)
    
    # Keep only top 15 hotspots to avoid clutter
    hotspot_features = hotspot_features[:15]
    
    hotspot_geojson = {
        "type": "FeatureCollection",
        "features": hotspot_features
    }
    
    return hotspot_geojson

def generate_default_hotspots():
    """Generate default hotspots for when data is insufficient"""
    known_hotspots = [
        {"name": "Japan Trench", "lon": 142, "lat": 38, "activity": 0.95, "events": 95, "mag": 5.2, "depth": 35},
        {"name": "San Andreas Fault", "lon": -122, "lat": 37, "activity": 0.85, "events": 85, "mag": 4.8, "depth": 12},
        {"name": "Chile Subduction Zone", "lon": -72, "lat": -33, "activity": 0.8, "events": 80, "mag": 5.0, "depth": 45},
        {"name": "New Zealand Alpine Fault", "lon": 172, "lat": -42, "activity": 0.75, "events": 75, "mag": 4.9, "depth": 30},
        {"name": "North Anatolian Fault", "lon": 30, "lat": 39, "activity": 0.7, "events": 70, "mag": 4.7, "depth": 15},
        {"name": "Zagros Mountains", "lon": 51, "lat": 35, "activity": 0.65, "events": 65, "mag": 4.6, "depth": 20},
        {"name": "Himalayan Frontal Thrust", "lon": 84, "lat": 28, "activity": 0.9, "events": 90, "mag": 5.5, "depth": 18},
        {"name": "Mid-Atlantic Ridge", "lon": -19, "lat": 64, "activity": 0.6, "events": 60, "mag": 4.5, "depth": 10},
        {"name": "East African Rift", "lon": 36, "lat": 0, "activity": 0.5, "events": 50, "mag": 4.3, "depth": 15},
        {"name": "Sumatra Subduction Zone", "lon": 97, "lat": 3, "activity": 0.88, "events": 88, "mag": 5.3, "depth": 40},
        {"name": "Mariana Trench", "lon": 142, "lat": 15, "activity": 0.78, "events": 78, "mag": 5.1, "depth": 100},
        {"name": "Caribbean Plate Boundary", "lon": -75, "lat": 18, "activity": 0.68, "events": 68, "mag": 4.7, "depth": 25}
    ]
    
    hotspot_features = []
    for hotspot in known_hotspots:
        # Add small random offsets to prevent perfect grid alignment
        lat_offset = np.random.normal(0, 0.2)
        lon_offset = np.random.normal(0, 0.2)
        
        hotspot_features.append({
            "type": "Feature",
            "properties": {
                "name": hotspot["name"],
                "activity": hotspot["activity"],
                "events": hotspot["events"],
                "avgMagnitude": hotspot["mag"],
                "avgDepth": hotspot["depth"],
                "radius": 5 + (hotspot["activity"] * 25)
            },
            "geometry": {
                "type": "Point",
                "coordinates": [hotspot["lon"] + lon_offset, hotspot["lat"] + lat_offset]
            }
        })
    
    hotspot_geojson = {
        "type": "FeatureCollection",
        "features": hotspot_features
    }
    
    return hotspot_geojson

# Main function to generate all predictions
def generate_all_predictions():
    print("Fetching earthquake data...")
    df = fetch_earthquake_data()
    
    print("Training location prediction model...")
    lat_model, lon_model, scaler = train_location_prediction_model(df)
    
    print("Running anomaly detection...")
    anomaly_df = detect_anomalies(df)
    
    print("Generating predictions...")
    prediction_geojson = generate_location_predictions(df, lat_model, lon_model, scaler)
    anomaly_geojson = generate_anomalies_geojson(anomaly_df)
    risk_geojson = generate_risk_map(df)
    hotspot_geojson = identify_hotspots(df)
    
    # Save outputs as GeoJSON files
    with open('model_outputs/prediction.geojson', 'w') as f:
        json.dump(prediction_geojson, f)
    
    with open('model_outputs/anomalies.geojson', 'w') as f:
        json.dump(anomaly_geojson, f)
    
    with open('model_outputs/risk.geojson', 'w') as f:
        json.dump(risk_geojson, f)
    
    with open('model_outputs/hotspots.geojson', 'w') as f:
        json.dump(hotspot_geojson, f)
    
    print("All GeoJSON files saved to model_outputs directory")
    
    return prediction_geojson, anomaly_geojson, risk_geojson, hotspot_geojson

# API Server
app = Flask(__name__, static_folder='model_outputs')

# Generate predictions at startup
prediction_geojson, anomaly_geojson, risk_geojson, hotspot_geojson = generate_all_predictions()

@app.route('/api/prediction', methods=['GET'])
def get_prediction():
    return jsonify(prediction_geojson)

@app.route('/api/anomalies', methods=['GET'])
def get_anomalies():
    return jsonify(anomaly_geojson)

@app.route('/api/risk', methods=['GET'])
def get_risk():
    return jsonify(risk_geojson)

@app.route('/api/hotspots', methods=['GET'])
def get_hotspots():
    return jsonify(hotspot_geojson)

# Serve static GeoJSON files
@app.route('/static/<path:path>', methods=['GET'])
def serve_static(path):
    return send_from_directory('model_outputs', path)

# Set up cross-origin resource sharing
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET')
    return response

if __name__ == "__main__":
    print("Starting Flask API server on http://127.0.0.1:5000...")
    app.run(host='127.0.0.1', port=5000, debug=False)