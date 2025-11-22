import os
import io
import base64
from typing import List, Tuple, Optional, Dict
import numpy as np
import cv2

import gradio as gr
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw, ImageFont

from constants import MODEL_PATH, DATABASE_DIR, DATABASE_PATH
from detector import SignatureDetector, download_model
from pdf_utils import PDFProcessor
from signature_cropper import SignatureCropper


class PDFSignatureProcessor:
    """Helper class to store processed PDF pages and signatures."""
    
    def __init__(self):
        self.pages_data = []  # List of dicts with page info
        self.current_page_idx = 0
        
    def reset(self):
        """Reset all stored data."""
        self.pages_data = []
        self.current_page_idx = 0
    
    def add_page(self, page_num: int, annotated_image: Image.Image, 
                 signatures: List[Tuple[Image.Image, float]], metrics: dict):
        """Add a processed page."""
        self.pages_data.append({
            'page_num': page_num,
            'annotated_image': annotated_image,
            'signatures': signatures,
            'metrics': metrics
        })
    
    def get_page(self, page_idx: int) -> Optional[Dict]:
        """Get data for a specific page."""
        if 0 <= page_idx < len(self.pages_data):
            return self.pages_data[page_idx]
        return None
    
    def get_total_pages(self) -> int:
        """Get total number of processed pages."""
        return len(self.pages_data)
    
    def get_current_page(self) -> Optional[Dict]:
        """Get current page data."""
        return self.get_page(self.current_page_idx)


def create_pdf_gradio_interface():
    """Create enhanced Gradio interface with multi-page PDF signature extraction."""
    
    # Download model if it doesn't exist
    if not os.path.exists(MODEL_PATH):
        download_model()

    # Initialize components
    detector = SignatureDetector(MODEL_PATH)
    pdf_processor = PDFProcessor(dpi=200)
    signature_cropper = SignatureCropper(padding=10)
    pdf_data = PDFSignatureProcessor()

    css = """
    .custom-button {
        background-color: #b0ffb8 !important;
        color: black !important;
    }
    .custom-button:hover {
        background-color: #b0ffb8b3 !important;
    }
    .nav-button {
        background-color: #4F46E5 !important;
        color: white !important;
        font-weight: 600 !important;
    }
    .nav-button:hover {
        background-color: #4338CA !important;
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
        font-size: 1.25rem !important;
        font-weight: 700 !important;
        color: #4F46E5 !important;
        padding: 0.75rem !important;
        text-align: center !important;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
        color: white !important;
        border-radius: 0.5rem !important;
    }
    .signature-gallery {
        border: 2px solid #4F46E5 !important;
        border-radius: 0.5rem !important;
        padding: 1rem !important;
        background-color: #f9fafb !important;
    }
    .page-section-title {
        font-size: 1.1rem !important;
        font-weight: 600 !important;
        color: #1f2937 !important;
        padding: 0.5rem !important;
        background-color: #e5e7eb !important;
        border-radius: 0.25rem !important;
        margin-bottom: 0.5rem !important;
    }
    """

    def create_page_header_image(page_num: int, sig_count: int, width: int = 600) -> Image.Image:
        """Create a visual header image for page separation in gallery."""
        height = 80
        img = Image.new('RGB', (width, height), color='#4F46E5')
        draw = ImageDraw.Draw(img)
        
        # Try to use a nice font, fall back to default if not available
        try:
            font = ImageFont.truetype("arial.ttf", 32)
            font_small = ImageFont.truetype("arial.ttf", 20)
        except:
            font = ImageFont.load_default()
            font_small = ImageFont.load_default()
        
        # Draw page title
        text = f"📄 Page {page_num}"
        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        x = (width - text_width) // 2
        y = 15
        draw.text((x, y), text, fill='white', font=font)
        
        # Draw signature count
        sub_text = f"{sig_count} signature(s) found"
        bbox_small = draw.textbbox((0, 0), sub_text, font=font_small)
        sub_width = bbox_small[2] - bbox_small[0]
        x_sub = (width - sub_width) // 2
        y_sub = y + text_height + 5
        draw.text((x_sub, y_sub), sub_text, fill='#E0E7FF', font=font_small)
        
        return img

    def create_signature_galleries_html() -> str:
        """Create HTML with separate containers for each page's signatures."""
        if pdf_data.get_total_pages() == 0:
            return ""
        
        html_parts = []
        
        for page_idx in range(pdf_data.get_total_pages()):
            page_data = pdf_data.get_page(page_idx)
            if page_data:
                page_num = page_data['page_num']
                signatures = page_data['signatures']
                sig_count = len(signatures)
                
                # Create accordion for this page
                html_parts.append(f"""
                <details open style="
                    border: 2px solid #4F46E5;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin-bottom: 1rem;
                    background-color: #F9FAFB;
                ">
                    <summary style="
                        font-size: 1.1rem;
                        font-weight: 600;
                        color: #4F46E5;
                        cursor: pointer;
                        padding: 0.5rem;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border-radius: 0.25rem;
                        margin: -1rem -1rem 1rem -1rem;
                        padding: 1rem;
                    ">
                        📄 Page {page_num} - {sig_count} signature(s) found
                    </summary>
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 1rem;
                        padding: 1rem 0;
                    ">
                """)
                
                if signatures:
                    for idx, (sig_img, conf) in enumerate(signatures, 1):
                        # Convert PIL image to base64
                        buffered = io.BytesIO()
                        sig_img.save(buffered, format="PNG")
                        img_str = base64.b64encode(buffered.getvalue()).decode()
                        
                        html_parts.append(f"""
                        <div style="
                            border: 1px solid #E5E7EB;
                            border-radius: 0.5rem;
                            padding: 0.5rem;
                            background-color: white;
                            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                        ">
                            <img src="data:image/png;base64,{img_str}" 
                                 style="width: 100%; height: auto; border-radius: 0.25rem;"
                                 alt="Signature {idx}"/>
                            <p style="
                                text-align: center;
                                margin-top: 0.5rem;
                                font-size: 0.875rem;
                                color: #6B7280;
                            ">Signature {idx} (conf: {conf:.2f})</p>
                        </div>
                        """)
                else:
                    html_parts.append("""
                    <div style="
                        grid-column: 1 / -1;
                        text-align: center;
                        padding: 2rem;
                        color: #9CA3AF;
                        font-style: italic;
                    ">
                        No signatures detected on this page
                    </div>
                    """)
                
                html_parts.append("</div></details>")
        
        return "".join(html_parts)

    def process_single_image(
        image: Image.Image, 
        conf_thres: float, 
        iou_thres: float
    ) -> Tuple[Image.Image, List[Tuple[Image.Image, float]], dict]:
        """Process a single image and return annotated image, signatures, and metrics."""
        
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
        
        return output_image, cropped_sigs, metrics

    def process_all_pdf_pages(
        pdf_path: Optional[str],
        conf_thres: float,
        iou_thres: float,
        progress=gr.Progress()
    ) -> Tuple:
        """Process all pages of a PDF and store results."""
        
        if pdf_path is None or not pdf_processor.is_pdf(pdf_path):
            return None, "Please upload a PDF file", None, None, None, None, gr.update(visible=False), gr.update(), gr.update(visible=False), ""
        
        try:
            # Reset stored data
            pdf_data.reset()
            
            # Convert PDF to images
            images = pdf_processor.pdf_to_images(pdf_path)
            page_count = len(images)
            
            progress(0, desc="Starting PDF processing...")
            
            # Process each page
            for idx, image in enumerate(images, 1):
                progress((idx - 1) / page_count, desc=f"Processing page {idx}/{page_count}...")
                
                # Detect and crop signatures
                output_image, cropped_sigs, metrics = process_single_image(
                    image, conf_thres, iou_thres
                )
                
                # Store page data
                pdf_data.add_page(idx, output_image, cropped_sigs, metrics)
            
            progress(1.0, desc="Processing complete!")
            
            # Generate signature galleries HTML once
            galleries_html = create_signature_galleries_html()
            
            # Display first page with galleries
            return display_page(0, galleries_html, show_galleries=True)
            
        except Exception as e:
            error_msg = f"Error processing PDF: {str(e)}"
            print(error_msg)
            return None, error_msg, None, None, None, None, gr.update(visible=False), gr.update(), gr.update(visible=False), ""

    def process_single_file(
        file_path: Optional[str],
        conf_thres: float,
        iou_thres: float
    ) -> Tuple:
        """Process a single image or single-page PDF."""
        
        if file_path is None:
            return None, None, None, None, None, None, gr.update(visible=False), gr.update(), gr.update(visible=False), ""
        
        try:
            # Reset stored data
            pdf_data.reset()
            
            if pdf_processor.is_pdf(file_path):
                # Extract first page only
                image = pdf_processor.extract_page(file_path, 0)
                page_info = "📄 PDF Page 1"
            else:
                # Load image
                image = Image.open(file_path)
                page_info = "🖼️ Image"
            
            # Process
            output_image, cropped_sigs, metrics = process_single_image(
                image, conf_thres, iou_thres
            )
            
            # Store as single page
            pdf_data.add_page(1, output_image, cropped_sigs, metrics)
            
            # Generate galleries HTML
            galleries_html = create_signature_galleries_html()
            
            # Create plots
            hist_data = pd.DataFrame({"Time (ms)": metrics["times"]})
            indices = range(
                metrics["start_index"], metrics["start_index"] + len(metrics["times"])
            )
            line_data = pd.DataFrame({
                "Inference": indices,
                "Time (ms)": metrics["times"],
                "Mean": [metrics["avg_time"]] * len(metrics["times"]),
            })
            hist_fig, line_fig = detector.create_plots(hist_data, line_data)
            
            return (
                output_image,
                page_info,
                f"{metrics['total_inferences']}",
                hist_fig,
                line_fig,
                f"{metrics['avg_time']:.2f}",
                gr.update(visible=False),  # Hide navigation
                gr.update(),  # Slider (not updated)
                gr.update(visible=True),  # Show galleries container
                galleries_html
            )
            
        except Exception as e:
            error_msg = f"Error: {str(e)}"
            print(error_msg)
            return None, error_msg, None, None, None, None, gr.update(visible=False), gr.update(), gr.update(visible=False), ""

    def display_page(page_idx: int, galleries_html: str = "", show_galleries: bool = False) -> Tuple:
        """Display a specific page from stored PDF data."""
        
        page_data = pdf_data.get_page(page_idx)
        
        if page_data is None:
            return None, "No page data available", None, None, None, None, gr.update(visible=False), gr.update(), gr.update(visible=False), ""
        
        total_pages = pdf_data.get_total_pages()
        pdf_data.current_page_idx = page_idx
        
        # Get page data
        output_image = page_data['annotated_image']
        cropped_sigs = page_data['signatures']
        metrics = page_data['metrics']
        page_num = page_data['page_num']
        
        # Page info with signature count on current page
        sig_count = len(cropped_sigs)
        
        # Count total signatures across all pages
        total_sigs = sum(len(pdf_data.get_page(i)['signatures']) for i in range(total_pages))
        
        page_info = f"📄 Page {page_num} of {total_pages} | {sig_count} signature(s) on this page | {total_sigs} total signature(s)"
        
        # Create plots
        hist_data = pd.DataFrame({"Time (ms)": metrics["times"]})
        indices = range(
            metrics["start_index"], metrics["start_index"] + len(metrics["times"])
        )
        line_data = pd.DataFrame({
            "Inference": indices,
            "Time (ms)": metrics["times"],
            "Mean": [metrics["avg_time"]] * len(metrics["times"]),
        })
        hist_fig, line_fig = detector.create_plots(hist_data, line_data)
        
        return (
            output_image,
            page_info,
            f"{metrics['total_inferences']}",
            hist_fig,
            line_fig,
            f"{metrics['avg_time']:.2f}",
            gr.update(visible=True),  # Show navigation
            gr.update(
                minimum=1,
                maximum=total_pages,
                value=page_num,
                label=f"Navigate to Page (1-{total_pages})"
            ),
            gr.update(visible=True) if show_galleries else gr.update(),  # Show on first load, don't change on navigation
            galleries_html if show_galleries else gr.update()  # Only update HTML when provided
        )

    def navigate_previous() -> Tuple:
        """Navigate to previous page."""
        current_idx = pdf_data.current_page_idx
        if current_idx > 0:
            return display_page(current_idx - 1)
        return display_page(current_idx)  # Stay on first page

    def navigate_next() -> Tuple:
        """Navigate to next page."""
        current_idx = pdf_data.current_page_idx
        total_pages = pdf_data.get_total_pages()
        if current_idx < total_pages - 1:
            return display_page(current_idx + 1)
        return display_page(current_idx)  # Stay on last page

    def navigate_to_page(page_num: int) -> Tuple:
        """Navigate to specific page."""
        page_idx = page_num - 1  # Convert to 0-indexed
        return display_page(page_idx)

    # Create Gradio interface
    with gr.Blocks(
        theme=gr.themes.Soft(
            primary_hue="indigo", secondary_hue="gray", neutral_hue="gray"
        ),
        css=css,
    ) as iface:
        gr.HTML(
            """
            <h1>📄 PDF Signature Extractor - Multi-Page Navigation</h1>
    
            <div style="display: flex; align-items: center; gap: 10px;">
                <a href="https://huggingface.co/tech4humans/yolov8s-signature-detector">
                    <img src="https://huggingface.co/datasets/huggingface/badges/resolve/main/model-on-hf-md-dark.svg" alt="Model on HF">
                </a>
                <a href="https://huggingface.co/datasets/tech4humans/signature-detection">
                    <img src="https://huggingface.co/datasets/huggingface/badges/resolve/main/dataset-on-hf-md-dark.svg" alt="Dataset on HF">
                </a>
            </div>
            """
        )
        gr.Markdown(
            """
            Extract signatures from **all pages** of a PDF document with easy page navigation!
           
            ✨ **Features:**
            - 📄 Process all PDF pages at once
            - 🖼️ Navigate between pages to view annotated documents
            - 🔍 **All signatures** displayed together, grouped by page number
            - 📊 Real-time metrics for each page
            
            💡 **How it works:** Process once → Gallery shows all signatures → Navigate to review each page
            
            ---
            """
        )

        with gr.Row(equal_height=True, elem_classes="main-container"):
            # Left column for controls
            with gr.Column(scale=1):
                with gr.Tab("Single Page"):
                    input_file = gr.File(
                        label="Upload Image/PDF (single page)",
                        file_types=[".jpg", ".jpeg", ".png", ".pdf"],
                        type="filepath"
                    )
                    
                    with gr.Row():
                        clear_single_btn = gr.ClearButton([input_file], value="Clear")
                        detect_single_btn = gr.Button("Process File", elem_classes="custom-button")
                
                with gr.Tab("Multi-Page PDF"):
                    input_pdf = gr.File(
                        label="Upload PDF (all pages)",
                        file_types=[".pdf"],
                        type="filepath"
                    )
                    
                    with gr.Row():
                        clear_pdf_btn = gr.ClearButton([input_pdf], value="Clear")
                        process_pdf_btn = gr.Button("Process All Pages", elem_classes="custom-button")

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
                
                # Page navigation controls
                with gr.Row(visible=False) as nav_controls:
                    prev_btn = gr.Button("◀ Previous", elem_classes="nav-button", scale=1)
                    page_slider = gr.Slider(
                        minimum=1,
                        maximum=10,
                        value=1,
                        step=1,
                        label="Page Navigation",
                        scale=3
                    )
                    next_btn = gr.Button("Next ▶", elem_classes="nav-button", scale=1)
                
                output_image = gr.Image(label="Detection Results")
                
                # Signature galleries - one per page in separate containers
                gr.Markdown("### 🖼️ Extracted Signatures by Page")
                signature_galleries_container = gr.Column(visible=False)
                with signature_galleries_container:
                    signature_galleries_html = gr.HTML()

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
                avg_inference_time = gr.Textbox(
                    label="Average Inference Time (ms)",
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
                1. Upload an image or single-page PDF
                2. Click "Process File"
                3. View signatures below
                
                ### Multi-Page PDF Mode:
                1. Upload a PDF document
                2. Click "Process All Pages" (processes entire PDF)
                3. **All signatures** from all pages are displayed grouped by page in the gallery
                4. Use **◀ Previous** / **Next ▶** buttons to navigate through annotated pages
                5. Or use the **slider** to jump to specific page views
                
                ### Features:
                - All pages are processed once
                - Navigate freely between annotated page views
                - Gallery shows **all signatures from all pages** (grouped)
                - Metrics updated for current page view
                
                ---
                
                **Developed by [Tech4Humans](https://www.tech4h.com.br/)** | **Model:** [YOLOv8s](https://huggingface.co/tech4humans/yolov8s-signature-detector)
                """
            )

        # Event handlers
        outputs_list = [
            output_image,
            page_info_display,
            total_inferences,
            hist_plot,
            line_plot,
            avg_inference_time,
            nav_controls,
            page_slider,
            signature_galleries_container,
            signature_galleries_html
        ]
        
        # Single file processing
        detect_single_btn.click(
            fn=process_single_file,
            inputs=[input_file, confidence_threshold, iou_threshold],
            outputs=outputs_list
        )
        
        # Multi-page PDF processing
        process_pdf_btn.click(
            fn=process_all_pdf_pages,
            inputs=[input_pdf, confidence_threshold, iou_threshold],
            outputs=outputs_list
        )
        
        # Navigation controls
        prev_btn.click(
            fn=navigate_previous,
            inputs=[],
            outputs=outputs_list
        )
        
        next_btn.click(
            fn=navigate_next,
            inputs=[],
            outputs=outputs_list
        )
        
        page_slider.change(
            fn=navigate_to_page,
            inputs=[page_slider],
            outputs=outputs_list
        )
        
        # Clear buttons
        clear_single_btn.add([output_image, page_info_display, signature_galleries_html])
        clear_pdf_btn.add([output_image, page_info_display, signature_galleries_html])
    
    return iface


if __name__ == "__main__":
    if not os.path.exists(DATABASE_PATH):
        os.makedirs(DATABASE_DIR, exist_ok=True)
    
    iface = create_pdf_gradio_interface()
    iface.launch(ssr_mode=False, share=True)
