# 🚀 Quick Start Guide

## Choose Your Application

This project offers **two Gradio interfaces** for signature detection:

### 1️⃣ **app.py** - Image Interface
For processing **images only** with folder upload support.

### 2️⃣ **pdf_app.py** - PDF & Image Interface  
For processing **both PDFs and images** with batch PDF processing.

---

## 📦 Installation

### Basic Installation (for app.py)
```bash
pip install -r requirements.txt
```

### PDF Support (for pdf_app.py)
```bash
pip install -r requirements.txt
pip install -r requirements_pdf.txt
```

---

## 🎮 Running the Applications

### Option 1: Image-Only Interface
```bash
python app.py
```

**Features:**
- ✅ Single image upload
- ✅ Folder upload (batch process images)
- ✅ Example gallery
- ✅ Real-time metrics

**Best for:** Processing multiple individual image files

---

### Option 2: PDF & Image Interface
```bash
python pdf_app.py
```

**Features:**
- ✅ PDF document upload (multi-page)
- ✅ Image upload (JPG, PNG)
- ✅ Single page or all pages mode
- ✅ Page selector
- ✅ Batch PDF processing
- ✅ Real-time metrics

**Best for:** Processing PDF documents and extracting signatures from multiple pages

---

## 📊 Quick Comparison

| Feature | app.py | pdf_app.py |
|---------|--------|------------|
| **Images (JPG/PNG)** | ✅ | ✅ |
| **PDF Files** | ❌ | ✅ |
| **Folder Upload** | ✅ | ❌ |
| **PDF Batch Processing** | ❌ | ✅ |
| **Page Selection** | ❌ | ✅ |
| **Example Gallery** | ✅ | ❌ |
| **Best Use Case** | Multiple images | PDF documents |

---

## 🎯 Quick Usage Examples

### Using app.py

1. **Start the app:**
   ```bash
   python app.py
   ```

2. **Upload an image** in the "Single Image" tab

3. **Adjust thresholds** (optional):
   - Confidence: 0.25 (default)
   - IoU: 0.5 (default)

4. **Click "Detect"** to see results

5. **For batch processing:** Use "Image Folder" tab

---

### Using pdf_app.py

1. **Start the app:**
   ```bash
   python pdf_app.py
   ```

2. **Upload a PDF or image**

3. **Choose mode:**
   - **Single Page:** Select specific page number
   - **All Pages:** Process first page initially

4. **Click "Detect Signatures"**

5. **For batch:** Use "Batch PDF Processing" tab and click "Process All Pages"

---

## 💻 Programmatic Usage

You can also use the detection system in your own Python scripts:

```python
from pdf_utils import PDFProcessor
from detector import SignatureDetector
from constants import MODEL_PATH
from PIL import Image

# Initialize
detector = SignatureDetector(MODEL_PATH)
pdf_processor = PDFProcessor(dpi=200)

# Example 1: Process an image
image = Image.open("document.jpg")
output_image, metrics = detector.detect(image, conf_thres=0.25, iou_thres=0.5)
output_image.save("output.png")

# Example 2: Process a PDF
images = pdf_processor.pdf_to_images("contract.pdf")
for i, page_image in enumerate(images, 1):
    output, metrics = detector.detect(page_image)
    output.save(f"page_{i}_output.png")
```

See `example_pdf_usage.py` for more detailed examples.

---

## 🎨 Interface Preview

### app.py Interface
```
┌─────────────────────────────────────────┐
│  Tech4Humans - Signature Detector       │
├─────────────────────────────────────────┤
│  [Single Image] [Image Folder]          │
│                                          │
│  Upload your document                    │
│  [📁 Browse...]                          │
│                                          │
│  Confidence Threshold: 0.25              │
│  IoU Threshold: 0.5                      │
│                                          │
│  [Clear] [Detect]                        │
│                                          │
│  Examples: [img1] [img2] [img3]...       │
└─────────────────────────────────────────┘
```

### pdf_app.py Interface
```
┌─────────────────────────────────────────┐
│  Tech4Humans - PDF & Image Signature    │
│  Extractor                               │
├─────────────────────────────────────────┤
│  [Single File] [Batch PDF Processing]   │
│                                          │
│  Upload PDF or Image                     │
│  [📄 Browse...]                          │
│                                          │
│  Processing Mode: ○ Single Page          │
│                   ○ All Pages            │
│  Page Number: [1] ────────               │
│                                          │
│  Confidence Threshold: 0.25              │
│  IoU Threshold: 0.5                      │
│                                          │
│  [Clear] [Detect Signatures]             │
│                                          │
│  📄 Page 1 of 5                          │
│  [Detected Image Display]                │
└─────────────────────────────────────────┘
```

---

## ⚙️ Configuration

### Adjust Detection Sensitivity

**Confidence Threshold** (0.0-1.0):
- **Lower (0.15-0.25)**: More detections, may include false positives
- **Higher (0.4-0.6)**: Fewer detections, more confident results
- **Default: 0.25** (balanced)

**IoU Threshold** (0.0-1.0):
- **Lower (0.3-0.4)**: Keep overlapping boxes
- **Higher (0.6-0.8)**: Remove more overlaps
- **Default: 0.5** (balanced)

### PDF Quality Settings

Edit `pdf_utils.py` to change DPI:
```python
pdf_processor = PDFProcessor(dpi=200)  # Change to 150 or 300
```

- **150 DPI**: Faster, lower quality
- **200 DPI**: Balanced (recommended)
- **300 DPI**: Slower, higher quality

---

## 🐛 Troubleshooting

### Model not downloading?
```bash
# Set HuggingFace token in .env file
HF_TOKEN=your_token_here
```

### PDF not loading?
```bash
pip install --upgrade PyMuPDF
```

### Slow performance?
- Reduce DPI to 150
- Process single pages instead of batch
- Lower confidence threshold

### No signatures detected?
- Lower confidence threshold to 0.15-0.20
- Check document quality
- Ensure signatures are visible and not too small

---

## 📚 Documentation

- **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** - Complete technical documentation
- **[PDF_APP_README.md](PDF_APP_README.md)** - PDF application guide
- **[example_pdf_usage.py](example_pdf_usage.py)** - Code examples

---

## 🎯 Next Steps

1. **Try the basic interface** with `app.py`
2. **Explore PDF processing** with `pdf_app.py`
3. **Read the documentation** for advanced features
4. **Experiment with thresholds** to optimize for your use case
5. **Integrate into your workflow** using the Python API

---

## 📞 Support

- **Model Card**: [HuggingFace](https://huggingface.co/tech4humans/yolov8s-signature-detector)
- **Dataset**: [HuggingFace Datasets](https://huggingface.co/datasets/tech4humans/signature-detection)
- **GitHub**: [Repository](https://github.com/tech4ai/t4ai-signature-detect-server)

---

**Ready to detect signatures? Pick an app and start processing! 🚀**
