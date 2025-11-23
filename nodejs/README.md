# 📝 Signature Detection System - Node.js/TypeScript

A Node.js/TypeScript implementation of the signature detection system using YOLOv8 and ONNX Runtime, with a clean HTML/CSS/JS frontend.

---

## 🎥 Demo Video

**Watch the system in action:** [Demo Video on Google Drive](https://drive.google.com/file/d/1ZNG5jIFpTrwEoAjkndUAKllohoySiD52/view?usp=sharing)

---

## 🎯 Features

- ✅ **YOLOv8 ONNX Model** - Fast signature detection using pre-trained model
- ✅ **Multi-Page PDF Support** - Process entire PDF documents at once
- ✅ **Single Page Mode** - Quick detection for images and single-page PDFs
- ✅ **Automatic Cropping** - Extract individual signatures with padding
- ✅ **Page Navigation** - Navigate through PDF pages with Previous/Next buttons and slider
- ✅ **Grouped Signatures** - Signatures displayed in collapsible containers by page
- ✅ **Performance Metrics** - Real-time tracking of inference times
- ✅ **Modern UI** - Clean, responsive interface with gradient design
- ✅ **TypeScript** - Type-safe implementation
- ✅ **SQLite Database** - Persistent metrics storage

## 📁 Project Structure

```
nodejs/
├── src/                       # TypeScript source files
│   ├── server.ts             # Express server
│   ├── detector.ts           # YOLOv8 detector
│   ├── pdfUtils.ts           # PDF processing
│   ├── signatureCropper.ts  # Signature extraction
│   ├── metricsStorage.ts    # Metrics database
│   ├── utils.ts              # Helper functions
│   ├── types.ts              # TypeScript interfaces
│   └── constants.ts          # Configuration constants
├── public/                    # Frontend files
│   ├── index.html            # Main HTML page
│   ├── styles.css            # Styles
│   └── app.js                # Frontend JavaScript
├── dist/                      # Compiled JavaScript (generated)
├── db/                        # SQLite database (generated)
├── model/                     # ONNX model (copy from parent)
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **ONNX Model** - Copy `model.onnx` from parent directory to `./model/`

### Installation

1. **Navigate to the nodejs directory**
   ```bash
   cd nodejs
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Copy the ONNX model**
   ```bash
   # Create model directory
   mkdir model
   
   # Put model file `model.onnx` in it
   ```

### Running the Application

#### Development Mode (with auto-reload)
```bash
npm run dev
```

#### Production Mode
```bash
# Build TypeScript
npm run build

# Start server
npm start
```

The server will start at `http://localhost:3000`

## 📖 Usage

### Web Interface

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Choose your mode:**
   - **Single Page**: For images or single-page PDFs
   - **Multi-Page PDF**: For complete PDF documents

3. **Upload a file:**
   - Supported formats: JPG, PNG, PDF
   - Max file size: 50MB

4. **Adjust detection settings** (optional):
   - **Confidence Threshold**: 0.00 - 1.00 (default: 0.25)
   - **IoU Threshold**: 0.00 - 1.00 (default: 0.50)

5. **Click "Detect Signatures"** or **"Process All Pages"**

6. **Review results:**
   - View annotated document with bounding boxes
   - See extracted signatures grouped by page
   - Navigate between PDF pages (multi-page mode)
   - Check performance metrics

### API Endpoints

#### Process Single File
```bash
POST /api/process-single
Content-Type: multipart/form-data

Parameters:
- file: Image or PDF file
- conf_threshold: Confidence threshold (optional, default: 0.25)
- iou_threshold: IoU threshold (optional, default: 0.50)

Response:
{
  "success": true,
  "annotatedImage": "base64_string",
  "signatures": [
    {
      "image": "base64_string",
      "confidence": 0.95
    }
  ],
  "boxes": [...],
  "metrics": {...}
}
```

#### Process Multi-Page PDF
```bash
POST /api/process-pdf
Content-Type: multipart/form-data

Parameters:
- file: PDF file
- conf_threshold: Confidence threshold (optional)
- iou_threshold: IoU threshold (optional)

Response:
{
  "success": true,
  "pages": [
    {
      "pageNum": 1,
      "annotatedImage": "base64_string",
      "signatures": [...],
      "metrics": {...}
    }
  ],
  "totalPages": 10,
  "totalSignatures": 15
}
```

#### Get Metrics
```bash
GET /api/metrics

Response:
{
  "totalInferences": 150,
  "avgInferenceTime": 175.5,
  "recentTimes": [180, 170, 175, ...],
  "startIndex": 50
}
```

#### Health Check
```bash
GET /api/health

Response:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🎨 Features in Detail

### Single Page Mode
- Upload an image or single-page PDF
- Get instant detection results
- View annotated document with bounding boxes
- See all detected signatures in a grid

### Multi-Page PDF Mode
- Process entire PDFs at once
- Navigate between pages with:
  - Previous/Next buttons
  - Page slider for instant jumping
- Signatures organized in collapsible containers by page
- Static signature display (no refresh on navigation)

### Signature Display
- Grouped by page in expandable sections
- Each signature shows confidence score
- Grid layout for easy scanning
- "No signatures" message for empty pages

### Performance Metrics
- Total inferences count
- Average inference time
- Last inference time
- Persistent storage in SQLite

## ⚙️ Configuration
### Constants

Edit `src/constants.ts` to change:
- Model paths and settings
- Detection thresholds
- PDF processing options
- Server configuration

## 🏗️ Development

### Build TypeScript
```bash
npm run build
```

### Watch Mode (auto-compile)
```bash
npm run watch
```

### Clean Build
```bash
npm run clean
npm run build
```

### Project Scripts
```json
{
  "build": "tsc",
  "start": "node dist/server.js",
  "dev": "ts-node src/server.ts",
  "watch": "tsc --watch",
  "clean": "rimraf dist"
}
```

## 📦 Dependencies

### Runtime Dependencies
- `onnxruntime-node` - ONNX inference engine
- `express` - Web server framework
- `multer` - File upload handling
- `sharp` - Image processing
- `pdf-lib` - PDF manipulation
- `canvas` - Image rendering
- `better-sqlite3` - SQLite database
- `dotenv` - Environment configuration
- `cors` - CORS middleware

### Development Dependencies
- `typescript` - TypeScript compiler
- `ts-node` - TypeScript execution
- `@types/*` - Type definitions
- `rimraf` - Cross-platform file deletion

## 🔧 Troubleshooting

### Module Not Found Errors

Run `npm install` to ensure all dependencies are installed.

### Model Loading Errors

Ensure the ONNX model is in the correct location: `model/model.onnx`

### Port Already in Use

Change the port in `.env`:
```env
PORT=3001
```

### SQLite Errors

Delete the database and restart:
```bash
rm -rf db/
npm start
```

### Canvas Build Errors

Canvas requires system dependencies. On Ubuntu/Debian:
```bash
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

On macOS:
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
```

On Windows, install [Windows Build Tools](https://github.com/felixrieseberg/windows-build-tools).

## 🆚 Comparison with Python Version

| Feature | Python (Gradio) | Node.js (Express) |
|---------|----------------|-------------------|
| **Framework** | Gradio | Express + HTML/CSS/JS |
| **Language** | Python | TypeScript |
| **Runtime** | Python 3.8+ | Node.js 18+ |
| **UI** | Gradio components | Custom HTML/CSS |
| **Inference** | ONNX Runtime (OpenVINO) | ONNX Runtime (Node.js) |
| **PDF Processing** | PyMuPDF | pdf-lib |
| **Image Processing** | PIL/OpenCV | Sharp/Canvas |
| **Database** | SQLite (Python) | SQLite (Node.js) |
| **Multi-Page PDF** | ✅ | ✅ |
| **API Endpoints** | Gradio API | REST API |
| **Type Safety** | Type hints | Full TypeScript |

## 📊 Performance

- **Inference Time**: ~150-200ms per image (CPU)
- **Memory Usage**: ~200-300MB (idle)
- **PDF Processing**: ~1-2s per page
- **Concurrent Requests**: Supported via Express
