/**
 * Constants for the signature detection system
 */

export const HUGGINGFACE_REPO_ID = "tech4humans/yolov8s-signature-detector";
export const MODEL_FILENAME = "model.onnx";
export const MODEL_DIR = "./model";
export const MODEL_PATH = `${MODEL_DIR}/${MODEL_FILENAME}`;
export const DATABASE_DIR = "./db";
export const DATABASE_PATH = `${DATABASE_DIR}/metrics.db`;

// Model configuration
export const MODEL_INPUT_SIZE = 640;
export const MODEL_INPUT_SHAPE = [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE];

// Detection defaults
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.25;
export const DEFAULT_IOU_THRESHOLD = 0.5;

// PDF processing defaults
export const DEFAULT_PDF_DPI = 200;
export const DEFAULT_PDF_SCALE = 2.0;

// Signature cropping defaults
export const DEFAULT_SIGNATURE_PADDING = 10;

// Server configuration
export const DEFAULT_PORT = 3000;
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const UPLOAD_DIR = "./uploads";

// Class name for signature detection (single class)
export const CLASS_NAMES = ["signature"];
