import os
from typing import List, Tuple, Optional
import numpy as np
import cv2

import gradio as gr
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image

from constants import MODEL_PATH, DATABASE_DIR, DATABASE_PATH
from detector import SignatureDetector, download_model
from pdf_utils import PDFProcessor
from signature_cropper import SignatureCropper


def create_pdf_gradio_interface():
    """Create Gradio interface for PDF and image signature detection."""
    
    # Download model if it doesn't exist
    if not os.path.exists(MODEL_PATH):
        download_model()

    # Initialize the detector, PDF processor, and signature cropper
    detector = SignatureDetector(MODEL_PATH)
    pdf_processor = PDFProcessor(dpi=200)
    signature_cropper = SignatureCropper(padding=10)

    css = """
    .custom-button {
        background-color: #b0ffb8 !important;
        color: black !important;
    }
    .custom-button:hover {
        background-color: #b0ffb8b3 !important;
    }
    .container {
        max-width: 1400px !important;
        margin: auto !important;
    }
    .main-container {
        gap: 20px !important;
    }
    .metrics-container {
        padding: 1.5rem !important;
        border-radius: 0.75rem !important;
        background-color: #1f2937 !important;
        margin: 1rem 0 !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
    }
    .page-info {
        font-size: 1.1rem !important;
        font-weight: 600 !important;
        color: #4F46E5 !important;
        padding: 0.5rem !important;
        text-align: center !important;
    }
    .signature-gallery {
        border: 2px solid #4F46E5 !important;
        border-radius: 0.5rem !important;
        padding: 1rem !important;
        background-color: #f9fafb !important;
    }
    """

    def process_file(
        file_path: Optional[str],
        conf_thres: float,
        iou_thres: float,
        process_all_pages: bool = True,
        page_number: int = 1
    ) -> Tuple:
        """
        Process either an image or PDF file for signature detection.
        
        Args:
            file_path: Path to uploaded file (image or PDF)
            conf_thres: Confidence threshold
            iou_thres: IoU threshold
            process_all_pages: Whether to process all pages (PDF only)
            page_number: Specific page to process (if not processing all)
            
        Returns:
            Tuple of outputs for Gradio components including cropped signatures
        """
        if file_path is None:
            return None, None, None, None, None, None, None, None
        
        try:
            # Check if file is PDF
            if pdf_processor.is_pdf(file_path):
                return process_pdf(
                    file_path, 
                    conf_thres, 
                    iou_thres, 
                    process_all_pages, 
                    page_number
                )
            else:
                # Process as image
                image = Image.open(file_path)
                return process_single_image(image, conf_thres, iou_thres, page_info="Image")
                
        except Exception as e:
            error_msg = f"Error processing file: {str(e)}"
            print(error_msg)
            return None, error_msg, None, None, None, None, None, None

    def process_single_image(
        image: Image.Image, 
        conf_thres: float, 
        iou_thres: float,
        page_info: str = ""
    ) -> Tuple:
        """Process a single image for signature detection and crop signatures."""
        
        # Detect signatures
        output_image, metrics = detector.detect(image, conf_thres, iou_thres)
        
        # Extract bounding boxes and crop signatures
        img_cv2 = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        img_height, img_width = img_cv2.shape[:2]
        
        # Get model output for cropping
        img_data, _ = detector.preprocess(image)
        outputs = detector.session.run(None, {detector.session.get_inputs()[0].name: img_data})
        
        # Extract boxes
        boxes = signature_cropper.extract_boxes_from_output(
            img_cv2, outputs, conf_thres, iou_thres,
            img_width, img_height, 640, 640
        )
        
        # Crop signatures
        cropped_sigs = signature_cropper.crop_signatures_from_detections(image, boxes)
        
        # Create gallery if signatures found
        if cropped_sigs:
            signature_gallery = [sig_img for sig_img, _ in cropped_sigs]
            sig_count_text = f"Found {len(cropped_sigs)} signature(s)"
        else:
            signature_gallery = []
            sig_count_text = "No signatures detected"

        # Create plots data
        hist_data = pd.DataFrame({"Time (ms)": metrics["times"]})
        indices = range(
            metrics["start_index"], metrics["start_index"] + len(metrics["times"])
        )

        line_data = pd.DataFrame(
            {
                "Inference": indices,
                "Time (ms)": metrics["times"],
                "Mean": [metrics["avg_time"]] * len(metrics["times"]),
            }
        )

        hist_fig, line_fig = detector.create_plots(hist_data, line_data)

        return (
            output_image,
            page_info,
            gr.update(value=f"{metrics['total_inferences']}", container=True),
            hist_fig,
            line_fig,
            f"{metrics['avg_time']:.2f}",
            f"{metrics['times'][-1]:.2f}",
            signature_gallery,
        )

    def process_pdf(
        pdf_path: str,
        conf_thres: float,
        iou_thres: float,
        process_all_pages: bool,
        page_number: int
    ) -> Tuple:
        """Process PDF file(s) for signature detection."""
        
        try:
            page_count = pdf_processor.get_page_count(pdf_path)
            
            if page_count == 0:
                return None, "Error: Could not read PDF", None, None, None, None, None, []
            
            if process_all_pages:
                # Process all pages
                images = pdf_processor.pdf_to_images(pdf_path)
                
                # Process first page initially
                if images:
                    result = process_single_image(
                        images[0], 
                        conf_thres, 
                        iou_thres,
                        page_info=f"📄 Page 1 of {page_count}"
                    )
                    
                    # Store all processed images for navigation
                    return result
                else:
                    return None, "Error: No pages found", None, None, None, None, None, []
            else:
                # Process specific page
                page_idx = page_number - 1  # Convert to 0-indexed
                
                if page_idx < 0 or page_idx >= page_count:
                    return None, f"Error: Page {page_number} does not exist (PDF has {page_count} pages)", None, None, None, None, None, []
                
                image = pdf_processor.extract_page(pdf_path, page_idx)
                return process_single_image(
                    image, 
                    conf_thres, 
                    iou_thres,
                    page_info=f"📄 Page {page_number} of {page_count}"
                )
                
        except Exception as e:
            error_msg = f"Error processing PDF: {str(e)}"
            print(error_msg)
            return None, error_msg, None, None, None, None, None, []

    def process_all_pdf_pages(
        pdf_path: Optional[str],
        conf_thres: float,
        iou_thres: float
    ):
        """Generator function to process all PDF pages sequentially."""
        
        if pdf_path is None or not pdf_processor.is_pdf(pdf_path):
            yield None, "Please upload a PDF file", None, None, None, None, None, []
            return
        
        try:
            images = pdf_processor.pdf_to_images(pdf_path)
            page_count = len(images)
            
            for idx, image in enumerate(images, 1):
                yield process_single_image(
                    image,
                    conf_thres,
                    iou_thres,
                    page_info=f"📄 Processing Page {idx} of {page_count}"
                )
                
        except Exception as e:
            yield None, f"Error: {str(e)}", None, None, None, None, None, []

    # Create Gradio interface
    with gr.Blocks(
        theme=gr.themes.Soft(
            primary_hue="indigo", secondary_hue="gray", neutral_hue="gray"
        ),
        css=css,
    ) as iface:
        gr.HTML(
            """
            <h1>Tech4Humans - PDF & Image Signature Extractor</h1>
    
            <div style="display: flex; align-items: center; gap: 10px;">
                <a href="https://huggingface.co/tech4humans/yolov8s-signature-detector">
                    <img src="https://huggingface.co/datasets/huggingface/badges/resolve/main/model-on-hf-md-dark.svg" alt="Model on HF">
                </a>
                <a href="https://huggingface.co/datasets/tech4humans/signature-detection">
                    <img src="https://huggingface.co/datasets/huggingface/badges/resolve/main/dataset-on-hf-md-dark.svg" alt="Dataset on HF">
                </a>
                <a href="https://github.com/tech4ai/t4ai-signature-detect-server">
                    <img src="https://img.shields.io/badge/github-%23121011.svg?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
                </a>
            </div>
            """
        )
        gr.Markdown(
            """
            Extract handwritten signatures from **PDF documents** or **images** using the fine-tuned **YOLOv8s** model.
           
            ✨ **Features:**
            - 📄 Process multi-page PDF documents
            - 🖼️ Support for image files (JPG, PNG)
            - 📊 Real-time performance metrics
            - 🎯 High accuracy signature detection
            
            ---
            """
        )

        with gr.Row(equal_height=True, elem_classes="main-container"):
            # Left column for controls
            with gr.Column(scale=1):
                with gr.Tab("Single File"):
                    input_file = gr.File(
                        label="Upload PDF or Image",
                        file_types=[".pdf", ".jpg", ".jpeg", ".png"],
                        type="filepath"
                    )
                    
                    process_mode = gr.Radio(
                        choices=["Single Page", "All Pages"],
                        value="Single Page",
                        label="Processing Mode (PDF only)",
                        info="Choose how to process PDF files"
                    )
                    
                    page_selector = gr.Slider(
                        minimum=1,
                        maximum=100,
                        value=1,
                        step=1,
                        label="Page Number",
                        info="Select specific page (Single Page mode only)",
                        visible=True
                    )
                    
                    with gr.Row():
                        clear_btn = gr.ClearButton([input_file], value="Clear")
                        detect_btn = gr.Button("Detect Signatures", elem_classes="custom-button")
                
                with gr.Tab("Batch PDF Processing"):
                    batch_file = gr.File(
                        label="Upload PDF for Batch Processing",
                        file_types=[".pdf"],
                        type="filepath"
                    )
                    
                    with gr.Row():
                        clear_batch_btn = gr.ClearButton([batch_file], value="Clear")
                        process_all_btn = gr.Button("Process All Pages", elem_classes="custom-button")

                with gr.Group():
                    confidence_threshold = gr.Slider(
                        minimum=0.0,
                        maximum=1.0,
                        value=0.25,
                        step=0.05,
                        label="Confidence Threshold",
                        info="Minimum confidence score for detection",
                    )
                    iou_threshold = gr.Slider(
                        minimum=0.0,
                        maximum=1.0,
                        value=0.5,
                        step=0.05,
                        label="IoU Threshold",
                        info="Intersection over Union threshold for NMS",
                    )

            # Right column for output
            with gr.Column(scale=1):
                page_info_display = gr.Textbox(
                    label="Page Information",
                    interactive=False,
                    elem_classes="page-info"
                )
                output_image = gr.Image(label="Detection Results")
                
                # Signature gallery section
                with gr.Accordion("🖼️ Extracted Signatures", open=True):
                    signature_gallery = gr.Gallery(
                        label="Cropped Signatures",
                        show_label=False,
                        elem_classes="signature-gallery",
                        columns=3,
                        rows=2,
                        height="auto",
                        object_fit="contain"
                    )

        # Metrics section
        with gr.Row(elem_classes="metrics-container"):
            with gr.Column(scale=1):
                total_inferences = gr.Textbox(
                    label="Total Inferences", 
                    show_copy_button=True, 
                    container=True
                )
                hist_plot = gr.Plot(label="Time Distribution", container=True)

            with gr.Column(scale=1):
                line_plot = gr.Plot(label="Time History", container=True)
                with gr.Row():
                    avg_inference_time = gr.Textbox(
                        label="Average Inference Time (ms)",
                        show_copy_button=True,
                        container=True,
                    )
                    last_inference_time = gr.Textbox(
                        label="Last Inference Time (ms)",
                        show_copy_button=True,
                        container=True,
                    )

        # Information section
        with gr.Row(elem_classes="container"):
            gr.Markdown(
                """
                ---
                ## 📖 How to Use
                
                ### Single File Mode:
                1. **Upload** a PDF or image file
                2. **Choose** processing mode (Single Page or All Pages for PDFs)
                3. **Adjust** confidence and IoU thresholds if needed
                4. **Click** "Detect Signatures" to process
                
                ### Batch PDF Processing:
                - Upload a PDF and click "Process All Pages" to extract signatures from all pages sequentially
                
                ### Key Metrics:
                - **Precision:** 94.74% | **Recall:** 89.72%
                - **mAP@50:** 94.50% | **mAP@50-95:** 67.35%
                - **Inference Time (CPU):** ~171.56 ms per page
                
                ---
                
                **Developed by [Tech4Humans](https://www.tech4h.com.br/)** | **Model:** [YOLOv8s](https://huggingface.co/tech4humans/yolov8s-signature-detector)
                """
            )

        # Event handlers
        def update_page_selector_visibility(mode):
            return gr.update(visible=(mode == "Single Page"))
        
        process_mode.change(
            fn=update_page_selector_visibility,
            inputs=[process_mode],
            outputs=[page_selector]
        )

        clear_btn.add([output_image, page_info_display, signature_gallery])
        clear_batch_btn.add([output_image, page_info_display, signature_gallery])

        detect_btn.click(
            fn=lambda file, conf, iou, mode, page: process_file(
                file, conf, iou, 
                process_all_pages=(mode == "All Pages"),
                page_number=page
            ),
            inputs=[input_file, confidence_threshold, iou_threshold, process_mode, page_selector],
            outputs=[
                output_image,
                page_info_display,
                total_inferences,
                hist_plot,
                line_plot,
                avg_inference_time,
                last_inference_time,
                signature_gallery,
            ],
        )

        process_all_btn.click(
            fn=process_all_pdf_pages,
            inputs=[batch_file, confidence_threshold, iou_threshold],
            outputs=[
                output_image,
                page_info_display,
                total_inferences,
                hist_plot,
                line_plot,
                avg_inference_time,
                last_inference_time,
                signature_gallery,
            ],
        )

        # Load initial metrics on page load
        iface.load(
            fn=detector.load_initial_metrics,
            inputs=None,
            outputs=[
                output_image,
                total_inferences,
                hist_plot,
                line_plot,
                avg_inference_time,
                last_inference_time,
            ],
        )
    
    return iface


if __name__ == "__main__":
    if not os.path.exists(DATABASE_PATH):
        os.makedirs(DATABASE_DIR, exist_ok=True)
    
    iface = create_pdf_gradio_interface()
    iface.launch(ssr_mode=False, share=True)
