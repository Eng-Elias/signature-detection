import cv2
import numpy as np
import onnxruntime as ort
import gradio as gr
import os
from huggingface_hub import hf_hub_download

# Model info
REPO_ID = "tech4humans/yolov8s-signature-detector"
FILENAME = "tune/trial_10/weights/best.onnx"
MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "model.onnx")

def download_model():
    """Download the model using Hugging Face Hub"""
    # Ensure model directory exists
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    try:
        print(f"Downloading model from {REPO_ID}...")
        # Download the model file from Hugging Face Hub
        model_path = hf_hub_download(
            repo_id=REPO_ID,
            filename=FILENAME,
            local_dir=MODEL_DIR,
            local_dir_use_symlinks=False,
            force_download=True,
            cache_dir=None
        )
        
        # Move the file to the correct location if it's not there already
        if os.path.exists(model_path) and model_path != MODEL_PATH:
            os.rename(model_path, MODEL_PATH)
            
            # Remove empty directories if they exist
            empty_dir = os.path.join(MODEL_DIR, "tune")
            if os.path.exists(empty_dir):
                import shutil
                shutil.rmtree(empty_dir)
            
        print("Model downloaded successfully!")
        return MODEL_PATH
        
    except Exception as e:
        print(f"Error downloading model: {str(e)}")
        raise e
    
class SignatureDetector:
    def __init__(self, model_path):
        self.model_path = model_path
        self.classes = ["signature"]
        self.color_palette = np.random.uniform(0, 255, size=(len(self.classes), 3))
        self.input_width = 640
        self.input_height = 640
        
        # Initialize ONNX Runtime session
        self.session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
        
    def preprocess(self, img):
        # Convert PIL Image to cv2 format
        img_cv2 = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        
        # Get image dimensions
        self.img_height, self.img_width = img_cv2.shape[:2]
        
        # Convert back to RGB for processing
        img_rgb = cv2.cvtColor(img_cv2, cv2.COLOR_BGR2RGB)
        
        # Resize
        img_resized = cv2.resize(img_rgb, (self.input_width, self.input_height))
        
        # Normalize and transpose
        image_data = np.array(img_resized) / 255.0
        image_data = np.transpose(image_data, (2, 0, 1))
        image_data = np.expand_dims(image_data, axis=0).astype(np.float32)
        
        return image_data, img_cv2
    
    def draw_detections(self, img, box, score, class_id):
        x1, y1, w, h = box
        color = self.color_palette[class_id]
        
        cv2.rectangle(img, (int(x1), int(y1)), (int(x1 + w), int(y1 + h)), color, 2)
        
        label = f"{self.classes[class_id]}: {score:.2f}"
        (label_width, label_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        
        label_x = x1
        label_y = y1 - 10 if y1 - 10 > label_height else y1 + 10
        
        cv2.rectangle(
            img,
            (int(label_x), int(label_y - label_height)),
            (int(label_x + label_width), int(label_y + label_height)),
            color,
            cv2.FILLED
        )
        
        cv2.putText(img, label, (int(label_x), int(label_y)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
    
    def postprocess(self, input_image, output, conf_thres, iou_thres):
        outputs = np.transpose(np.squeeze(output[0]))
        rows = outputs.shape[0]
        
        boxes = []
        scores = []
        class_ids = []
        
        x_factor = self.img_width / self.input_width
        y_factor = self.img_height / self.input_height
        
        for i in range(rows):
            classes_scores = outputs[i][4:]
            max_score = np.amax(classes_scores)
            
            if max_score >= conf_thres:
                class_id = np.argmax(classes_scores)
                x, y, w, h = outputs[i][0], outputs[i][1], outputs[i][2], outputs[i][3]
                
                left = int((x - w / 2) * x_factor)
                top = int((y - h / 2) * y_factor)
                width = int(w * x_factor)
                height = int(h * y_factor)
                
                class_ids.append(class_id)
                scores.append(max_score)
                boxes.append([left, top, width, height])
        
        indices = cv2.dnn.NMSBoxes(boxes, scores, conf_thres, iou_thres)
        
        for i in indices:
            box = boxes[i]
            score = scores[i]
            class_id = class_ids[i]
            self.draw_detections(input_image, box, score, class_id)
        
        return cv2.cvtColor(input_image, cv2.COLOR_BGR2RGB)
    
    def detect(self, image, conf_thres, iou_thres):
        # Preprocess the image
        img_data, original_image = self.preprocess(image)
        
        # Run inference
        outputs = self.session.run(None, {self.session.get_inputs()[0].name: img_data})
        
        # Postprocess the results
        output_image = self.postprocess(original_image, outputs, conf_thres, iou_thres)
        
        return output_image

def create_gradio_interface():
    # Download model if it doesn't exist
    if not os.path.exists(MODEL_PATH):
        download_model()
    
    # Initialize the detector
    detector = SignatureDetector(MODEL_PATH)
    
    # Create Gradio interface
    iface = gr.Interface(
        fn=detector.detect,
        inputs=[
            gr.Image(label="Upload your Document", type="pil"),
            gr.Slider(minimum=0.0, maximum=1.0, value=0.2, step=0.05, 
                     label="Confidence Threshold", 
                     info="Adjust the minimum confidence score required for detection"),
            gr.Slider(minimum=0.0, maximum=1.0, value=0.5, step=0.05, 
                     label="IoU Threshold",
                     info="Adjust the Intersection over Union threshold for NMS")
        ],
        outputs=gr.Image(label="Detection Results"),
        title="Signature Detector",
        description="Upload an image to detect signatures using YOLOv8. Use the sliders to adjust detection sensitivity.",
        examples=[
            ["assets/images/example_1.jpg", 0.2, 0.5],
            ["assets/images/example_2.jpg", 0.2, 0.5],
            ["assets/images/example_3.jpg", 0.2, 0.5],
            ["assets/images/example_4.jpg", 0.2, 0.5]
        ]
    )
    
    return iface

if __name__ == "__main__":
    iface = create_gradio_interface()
    iface.launch()