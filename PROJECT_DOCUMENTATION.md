# Signature Detection System - Project Documentation

## 🎯 Overview

This project is an AI-powered **Signature Detection System** that identifies handwritten signatures in document images using a fine-tuned **YOLOv8s** model. The system provides a web interface built with Gradio for easy interaction and real-time performance metrics tracking.

---

## 📁 Project Structure

```
signature-detection/
├── app.py                    # Gradio web interface
├── detector.py               # Core detection logic
├── constants.py              # Configuration constants
├── metrics_storage.py        # SQLite database for metrics
├── requirements.txt          # Python dependencies
├── .env                      # Environment variables (HF_TOKEN)
├── model/                    # Downloaded ONNX model
│   └── model.onnx
├── db/                       # SQLite database
│   └── metrics.db
└── assets/images/            # Example images
```

---

## 🔄 How It Works - Step by Step

### **Step 1: Initialization**
- Application checks if the YOLOv8s ONNX model exists locally
- If not found, downloads from HuggingFace Hub (`tech4humans/yolov8s-signature-detector`)
- Initializes ONNX Runtime with OpenVINO execution provider for optimized CPU inference
- Sets up SQLite database for storing inference metrics

### **Step 2: Image Upload**
User uploads a document image via two methods:
- **Single Image Upload**: Process one document at a time
- **Folder Upload**: Batch process multiple documents

### **Step 3: Preprocessing**
```python
Input Image (PIL) → Convert to OpenCV format → Resize to 640x640 → Normalize (÷255) → Transpose to CHW format → Add batch dimension
```
- Original aspect ratio is recorded for proper box scaling later
- Image is normalized to [0, 1] range
- Format changed from HWC (Height, Width, Channels) to CHW for model input

### **Step 4: Inference**
- Preprocessed image fed into ONNX Runtime session
- Model predicts bounding boxes, confidence scores, and class probabilities
- Inference time is measured in milliseconds

### **Step 5: Postprocessing**
- Filter detections by confidence threshold (default: 0.25)
- Apply Non-Maximum Suppression (NMS) with IoU threshold (default: 0.5)
- Scale bounding boxes back to original image dimensions
- Draw colored rectangles and labels on detected signatures

### **Step 6: Metrics Collection**
- Inference time stored in SQLite database
- Calculate running statistics:
  - Total inferences count
  - Average inference time (last 80 runs)
  - Time distribution histogram
  - Time history line chart

### **Step 7: Display Results**
- Annotated image with detected signatures
- Performance metrics and visualizations
- Real-time updates for batch processing

---

## 🧩 Component Breakdown

### **1. constants.py**
Configuration hub for the entire application:
- `REPO_ID`: HuggingFace repository for the model
- `MODEL_PATH`: Local path to ONNX model file
- `DATABASE_PATH`: SQLite database location

### **2. metrics_storage.py**
Persistent metrics storage using SQLite:
- **Methods**:
  - `add_metric()`: Stores inference time with timestamp
  - `get_recent_metrics()`: Retrieves last 80 measurements
  - `get_total_inferences()`: Returns total inference count
  - `get_average_time()`: Calculates mean inference time

### **3. detector.py**
Core detection engine:
- **SignatureDetector Class**:
  - `preprocess()`: Prepares images for model input
  - `postprocess()`: Processes model output and applies NMS
  - `detect()`: Main detection pipeline
  - `draw_detections()`: Visualizes results on images
  - `create_plots()`: Generates performance charts

### **4. app.py**
Gradio web interface:
- **Features**:
  - Single/batch image processing
  - Adjustable confidence and IoU thresholds
  - Real-time metrics dashboard
  - Example images gallery
  - Responsive UI with custom CSS styling

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│ User Upload │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Preprocess     │ ← Resize (640x640), Normalize, Format
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ONNX Inference │ ← YOLOv8s Model + OpenVINO
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Postprocess    │ ← NMS, Threshold Filtering
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Draw Boxes     │ ← Annotate Image
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store Metrics   │ ← SQLite Database
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Display Result │ ← Gradio Interface
└─────────────────┘
```

---

## 💡 Input/Output Examples

### **Input Example**
```python
# Single Image
- Format: JPG, JPEG, PNG
- Size: Any (automatically resized to 640x640)
- Content: Document with handwritten signatures
- Example: Scanned contract, signed form, letter

# Parameters
- Confidence Threshold: 0.25 (range: 0.0-1.0)
- IoU Threshold: 0.5 (range: 0.0-1.0)
```

### **Output Example**
```python
# Annotated Image
- Original image with colored bounding boxes
- Label format: "signature: 0.95" (class name + confidence)
- Box color: Random RGB from palette

# Performance Metrics
{
    "total_inferences": 150,
    "avg_time": 171.56,          # milliseconds
    "times": [165.2, 172.8, ...], # Last 80 times
    "last_inference_time": 168.4
}

# Visualizations
- Histogram: Distribution of inference times
- Line Chart: Time history with running average
```

### **Real-World Scenario**
```
INPUT:
- PDF page converted to image (1200x1800 pixels)
- Contains 3 signatures in different locations

PROCESSING:
- Image resized to 640x640 for inference
- Model detects 3 signature regions
- Confidence scores: 0.97, 0.89, 0.92
- Inference time: ~170ms on CPU

OUTPUT:
- Original image with 3 green boxes
- Labels showing confidence scores
- Updated metrics dashboard
- All signatures correctly identified
```

---

## 🎯 Key Features

### **Model Performance**
- **Precision**: 94.74%
- **Recall**: 89.72%
- **mAP@50**: 94.50%
- **mAP@50-95**: 67.35%
- **Inference Time (CPU)**: ~171.56 ms

### **Technical Stack**
- **Model**: YOLOv8s (ONNX format)
- **Framework**: ONNX Runtime + OpenVINO
- **UI**: Gradio 5.23.1
- **Backend**: Python with OpenCV, NumPy
- **Database**: SQLite for metrics persistence

### **User Interface Features**
- Single image and batch processing modes
- Real-time adjustable thresholds
- Interactive examples gallery
- Performance metrics visualization
- Dark-themed professional UI

---

## 🚀 Usage Workflow

1. **Start Application**
   ```bash
   python app.py
   ```

2. **Upload Document**
   - Click "Upload your document" or use examples
   - Supported formats: JPG, PNG

3. **Adjust Settings** (Optional)
   - Confidence Threshold: Higher = fewer but more confident detections
   - IoU Threshold: Higher = less overlap between boxes

4. **Click "Detect"**
   - View annotated image with signature boxes
   - Check performance metrics and charts

5. **Batch Processing** (Optional)
   - Switch to "Image Folder" tab
   - Upload multiple images
   - Process sequentially with live updates

---

## 📈 Metrics Tracking

The system maintains persistent metrics across sessions:

- **Total Inferences**: Cumulative count since first run
- **Average Time**: Rolling average of last 80 inferences
- **Time Distribution**: Histogram showing inference time spread
- **Time History**: Line chart with mean reference line

All metrics stored in SQLite database (`db/metrics.db`) for historical analysis.

---

## 🔧 Configuration

### **Environment Variables** (.env)
```bash
HF_TOKEN=your_huggingface_token  # Optional, for private models
```

### **Adjustable Parameters**
- `conf_thres`: Minimum confidence score (0.0-1.0)
- `iou_thres`: NMS overlap threshold (0.0-1.0)
- Input size: Fixed at 640x640 (model requirement)

---

## 📝 Notes

- Model automatically downloads on first run (~20MB)
- Metrics persist between sessions
- CPU-optimized with OpenVINO acceleration
- Supports batch processing for efficiency
- Real-time performance monitoring included

---

**Developed by Tech4Humans** | [Model Card](https://huggingface.co/tech4humans/yolov8s-signature-detector) | [Dataset](https://huggingface.co/datasets/tech4humans/signature-detection)
