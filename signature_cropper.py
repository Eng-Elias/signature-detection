"""
Utility module for cropping detected signatures from images.
"""

import cv2
import numpy as np
from PIL import Image
from typing import List, Tuple


class SignatureCropper:
    """Utility class for cropping signatures from detected regions."""
    
    def __init__(self, padding: int = 10):
        """
        Initialize the signature cropper.
        
        Args:
            padding (int): Padding in pixels to add around cropped signatures
        """
        self.padding = padding
    
    def extract_boxes_from_output(
        self, 
        original_image: np.ndarray,
        output: np.ndarray,
        conf_thres: float,
        iou_thres: float,
        img_width: int,
        img_height: int,
        input_width: int = 640,
        input_height: int = 640
    ) -> List[Tuple[int, int, int, int, float]]:
        """
        Extract bounding boxes from model output.
        
        Args:
            original_image: Original image array
            output: Model output array
            conf_thres: Confidence threshold
            iou_thres: IoU threshold
            img_width: Original image width
            img_height: Original image height
            input_width: Model input width
            input_height: Model input height
            
        Returns:
            List of tuples (x, y, width, height, confidence)
        """
        outputs = np.transpose(np.squeeze(output[0]))
        rows = outputs.shape[0]
        
        boxes = []
        scores = []
        valid_boxes = []
        
        x_factor = img_width / input_width
        y_factor = img_height / input_height
        
        for i in range(rows):
            classes_scores = outputs[i][4:]
            max_score = np.amax(classes_scores)
            
            if max_score >= conf_thres:
                x, y, w, h = outputs[i][0], outputs[i][1], outputs[i][2], outputs[i][3]
                
                left = int((x - w / 2) * x_factor)
                top = int((y - h / 2) * y_factor)
                width = int(w * x_factor)
                height = int(h * y_factor)
                
                boxes.append([left, top, width, height])
                scores.append(float(max_score))
        
        # Apply Non-Maximum Suppression
        if boxes:
            indices = cv2.dnn.NMSBoxes(boxes, scores, conf_thres, iou_thres)
            
            for i in indices:
                box = boxes[i]
                score = scores[i]
                valid_boxes.append((box[0], box[1], box[2], box[3], score))
        
        return valid_boxes
    
    def crop_signature(
        self, 
        image: Image.Image, 
        box: Tuple[int, int, int, int]
    ) -> Image.Image:
        """
        Crop a signature region from an image.
        
        Args:
            image: PIL Image
            box: Tuple of (x, y, width, height)
            
        Returns:
            Cropped PIL Image
        """
        x, y, w, h = box
        
        # Add padding
        x1 = max(0, x - self.padding)
        y1 = max(0, y - self.padding)
        x2 = min(image.width, x + w + self.padding)
        y2 = min(image.height, y + h + self.padding)
        
        # Crop the image
        cropped = image.crop((x1, y1, x2, y2))
        
        return cropped
    
    def crop_signatures_from_detections(
        self,
        image: Image.Image,
        boxes: List[Tuple[int, int, int, int, float]]
    ) -> List[Tuple[Image.Image, float]]:
        """
        Crop all detected signatures from an image.
        
        Args:
            image: PIL Image
            boxes: List of (x, y, width, height, confidence) tuples
            
        Returns:
            List of tuples (cropped_image, confidence)
        """
        cropped_signatures = []
        
        for box_data in boxes:
            x, y, w, h, confidence = box_data
            box = (x, y, w, h)
            
            cropped_img = self.crop_signature(image, box)
            cropped_signatures.append((cropped_img, confidence))
        
        return cropped_signatures
    
    def create_signature_grid(
        self,
        signatures: List[Tuple[Image.Image, float]],
        max_width: int = 1200,
        bg_color: Tuple[int, int, int] = (255, 255, 255)
    ) -> Image.Image:
        """
        Create a grid image showing all cropped signatures.
        
        Args:
            signatures: List of (image, confidence) tuples
            max_width: Maximum width of the grid
            bg_color: Background color (RGB)
            
        Returns:
            PIL Image containing signature grid
        """
        if not signatures:
            # Return empty white image
            return Image.new('RGB', (400, 100), bg_color)
        
        # Calculate grid layout
        num_sigs = len(signatures)
        cols = min(3, num_sigs)  # Max 3 columns
        rows = (num_sigs + cols - 1) // cols
        
        # Find max dimensions
        max_sig_height = max(img.height for img, _ in signatures)
        max_sig_width = max(img.width for img, _ in signatures)
        
        # Scale if needed
        cell_width = min(max_sig_width + 40, max_width // cols)
        cell_height = max_sig_height + 60  # Extra space for label
        
        # Create grid image
        grid_width = cols * cell_width
        grid_height = rows * cell_height
        grid_img = Image.new('RGB', (grid_width, grid_height), bg_color)
        
        # Place signatures in grid
        for idx, (sig_img, confidence) in enumerate(signatures):
            row = idx // cols
            col = idx % cols
            
            # Calculate position
            x_offset = col * cell_width + 20
            y_offset = row * cell_height + 30
            
            # Resize if needed
            if sig_img.width > cell_width - 40:
                ratio = (cell_width - 40) / sig_img.width
                new_width = cell_width - 40
                new_height = int(sig_img.height * ratio)
                sig_img = sig_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Paste signature
            grid_img.paste(sig_img, (x_offset, y_offset))
            
            # Add label using PIL ImageDraw
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(grid_img)
            
            label_text = f"Signature {idx + 1} ({confidence:.2f})"
            
            # Draw text
            text_y = y_offset + sig_img.height + 5
            draw.text((x_offset, text_y), label_text, fill=(0, 0, 0))
        
        return grid_img
