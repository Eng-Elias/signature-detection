# 📝 Signature Detection System

[![Model on HF](https://huggingface.co/datasets/huggingface/badges/resolve/main/model-on-hf-md-dark.svg)](https://huggingface.co/tech4humans/yolov8s-signature-detector)
[![Dataset on HF](https://huggingface.co/datasets/huggingface/badges/resolve/main/dataset-on-hf-md-dark.svg)](https://huggingface.co/datasets/tech4humans/signature-detection)

> An AI-powered signature detection and extraction system using YOLOv8s, built for document processing and analysis.

---

## 🎥 Demo Video

**Watch the system in action:** [Demo Video on Google Drive](https://drive.google.com/file/d/1KjAXafPdObVq9uN_vrgzL8FHvkniRGpT/view?usp=sharing)

---

## 🎯 Overview

This project provides a complete **Signature Detection and Extraction System** that identifies and extracts handwritten signatures from document images and PDFs using a fine-tuned **YOLOv8s** model. The system offers three Gradio-based web interfaces for different use cases, from simple image processing to advanced multi-page PDF navigation.

### ✨ Key Features

- 🎯 **High-Accuracy Detection** - Fine-tuned YOLOv8s model on signature dataset
- 📄 **PDF Support** - Extract signatures from multi-page PDF documents
- 🖼️ **Automatic Cropping** - Extracts individual signatures with configurable padding
- 📊 **Performance Metrics** - Real-time inference time tracking and visualization
- 🔍 **Multi-Page Navigation** - Navigate through PDF pages with instant page switching
- 🎨 **Organized Display** - Signatures grouped by page in collapsible containers
- ⚡ **Optimized Inference** - OpenVINO-accelerated CPU inference
- 💾 **Persistent Storage** - SQLite database for metrics history

---

## 🎓 Usage Examples

### Web Interface

1. **Launch the application**
   ```bash
   python pdf_app_enhanced.py
   ```

2. **Open in browser** - Navigate to `http://localhost:7860`

3. **Upload your document** - Supports JPG, PNG, and PDF files

4. **Adjust thresholds** (optional)
   - **Confidence**: 0.25 (default) - Lower values detect more signatures
   - **IoU**: 0.5 (default) - Higher values reduce overlapping detections

5. **Process and review**
   - Click "Process All Pages" for PDFs
   - Navigate between pages using buttons or slider
   - Review extracted signatures grouped by page

## 📊 Performance

### Model Specifications

- **Architecture:** YOLOv8s (small variant)
- **Format:** ONNX (optimized)
- **Execution Provider:** OpenVINO (CPU-accelerated)
- **Inference Time:** ~170ms per image (CPU)

---

## 📁 Project Structure

```
signature-detection/
├── 📱 Applications
│   ├── app.py                      # Image-only interface
│   ├── pdf_app.py                  # PDF & image interface
│   └── pdf_app_enhanced.py         # Enhanced multi-page navigator
│
├── 🔧 Core Modules
│   ├── detector.py                 # YOLOv8s detection engine
│   ├── pdf_utils.py                # PDF processing utilities
│   ├── signature_cropper.py        # Signature extraction
│   ├── constants.py                # Configuration
│   └── metrics_storage.py          # Performance tracking
│
├── 📚 Documentation
│   ├── README.md                   # This file
│   ├── PROJECT_DOCUMENTATION.md    # Detailed documentation
│   ├── QUICKSTART.md               # Quick start guide
│   ├── PDF_APP_README.md           # PDF app guide
│   ├── ENHANCED_PDF_APP_README.md  # Enhanced app guide
│   ├── SIGNATURE_CROPPING_GUIDE.md # Cropping feature guide
│   ├── APP_COMPARISON.md           # Application comparison
│   ├── GROUPED_SIGNATURES_FEATURE.md
│   └── SEPARATE_CONTAINERS_FEATURE.md
│
├── 🔨 Examples
│   └── example_pdf_usage.py        # Programmatic usage examples
│
├── 📦 Configuration
│   ├── requirements.txt            # Python dependencies
│   ├── requirements_pdf.txt        # PDF dependencies
│   ├── .env.template               # Environment template
│   └── .gitignore
│
├── 💾 Data (generated)
│   ├── model/                      # Downloaded ONNX model
│   ├── db/                         # SQLite metrics database
│   └── assets/images/              # Example images
```

---

## 🛠️ Troubleshooting

### Model Download Issues

If the model doesn't download automatically:
1. Manually download from [HuggingFace](https://huggingface.co/tech4humans/yolov8s-signature-detector)
2. Place `model.onnx` in the `model/` directory

### Low Detection Accuracy

- Try lowering the confidence threshold (e.g., 0.15)
- Ensure images are clear and signatures are visible
- Check that signatures are not too small (resize if needed)

### Slow Performance

- Reduce PDF DPI (e.g., 150 instead of 200)
- Process fewer pages at once
- Close other applications to free up resources

---

## 📜 License

This project uses the YOLOv8 model from Ultralytics. Please refer to their licensing terms.

The dataset is available at [tech4humans/signature-detection](https://huggingface.co/datasets/tech4humans/signature-detection).

---

## 🙏 Acknowledgments

- **[Tech4Humans](https://www.tech4h.com.br/)** - Original model training and dataset
- **[Ultralytics](https://ultralytics.com/)** - YOLOv8 architecture
- **[Gradio](https://gradio.app/)** - Web interface framework
- **[OpenVINO](https://docs.openvino.ai/)** - Inference optimization

---
