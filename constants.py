import os

REPO_ID = "tech4humans/yolov8s-signature-detector"
FILENAME = "yolov8s.onnx"
MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "model.onnx")
DATABASE_DIR = os.path.join(os.getcwd(), "db")
DATABASE_PATH = os.path.join(DATABASE_DIR, "metrics.db")
