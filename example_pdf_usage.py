"""
Example script demonstrating programmatic usage of PDF signature extraction.
This script shows how to use the pdf_utils and detector modules without the Gradio interface.
"""

import os
from pdf_utils import PDFProcessor
from detector import SignatureDetector, download_model
from constants import MODEL_PATH


def process_pdf_example(pdf_path: str, output_dir: str = "output"):
    """
    Example: Process a PDF file and save annotated pages.
    
    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory to save output images
    """
    # Download model if needed
    if not os.path.exists(MODEL_PATH):
        print("Downloading model...")
        download_model()
    
    # Initialize components
    print("Initializing detector and PDF processor...")
    detector = SignatureDetector(MODEL_PATH)
    pdf_processor = PDFProcessor(dpi=200)
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Check if file is PDF
    if not pdf_processor.is_pdf(pdf_path):
        print(f"Error: {pdf_path} is not a PDF file")
        return
    
    # Get page count
    page_count = pdf_processor.get_page_count(pdf_path)
    print(f"PDF has {page_count} pages")
    
    # Convert all pages to images
    print("Converting PDF to images...")
    images = pdf_processor.pdf_to_images(pdf_path)
    
    # Process each page
    print("\nProcessing pages...")
    total_signatures = 0
    total_time = 0
    
    for i, image in enumerate(images, 1):
        print(f"\nPage {i}/{page_count}:")
        
        # Detect signatures
        output_image, metrics = detector.detect(
            image, 
            conf_thres=0.25, 
            iou_thres=0.5
        )
        
        # Save output
        output_path = os.path.join(output_dir, f"page_{i}_annotated.png")
        output_image.save(output_path)
        
        # Display metrics
        inference_time = metrics["times"][-1]
        total_time += inference_time
        
        print(f"  ✓ Processed in {inference_time:.2f}ms")
        print(f"  ✓ Saved to: {output_path}")
    
    # Summary
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    print(f"Total pages processed: {page_count}")
    print(f"Total processing time: {total_time:.2f}ms")
    print(f"Average time per page: {total_time/page_count:.2f}ms")
    print(f"Output directory: {output_dir}")


def process_single_page_example(pdf_path: str, page_number: int = 1):
    """
    Example: Process a single page from a PDF.
    
    Args:
        pdf_path: Path to the PDF file
        page_number: Page number to process (1-indexed)
    """
    # Download model if needed
    if not os.path.exists(MODEL_PATH):
        print("Downloading model...")
        download_model()
    
    # Initialize components
    print("Initializing detector and PDF processor...")
    detector = SignatureDetector(MODEL_PATH)
    pdf_processor = PDFProcessor(dpi=200)
    
    # Extract specific page
    print(f"Extracting page {page_number}...")
    page_idx = page_number - 1  # Convert to 0-indexed
    
    try:
        image = pdf_processor.extract_page(pdf_path, page_idx)
        
        # Detect signatures
        print("Detecting signatures...")
        output_image, metrics = detector.detect(image, conf_thres=0.25, iou_thres=0.5)
        
        # Save output
        output_path = f"page_{page_number}_output.png"
        output_image.save(output_path)
        
        # Display results
        print(f"\n✓ Page {page_number} processed successfully!")
        print(f"  Inference time: {metrics['times'][-1]:.2f}ms")
        print(f"  Total inferences: {metrics['total_inferences']}")
        print(f"  Average time: {metrics['avg_time']:.2f}ms")
        print(f"  Saved to: {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")


def process_image_example(image_path: str):
    """
    Example: Process a regular image file.
    
    Args:
        image_path: Path to the image file
    """
    from PIL import Image
    
    # Download model if needed
    if not os.path.exists(MODEL_PATH):
        print("Downloading model...")
        download_model()
    
    # Initialize detector
    print("Initializing detector...")
    detector = SignatureDetector(MODEL_PATH)
    
    # Load image
    print(f"Loading image: {image_path}")
    image = Image.open(image_path)
    
    # Detect signatures
    print("Detecting signatures...")
    output_image, metrics = detector.detect(image, conf_thres=0.25, iou_thres=0.5)
    
    # Save output
    output_path = "image_output.png"
    output_image.save(output_path)
    
    # Display results
    print(f"\n✓ Image processed successfully!")
    print(f"  Inference time: {metrics['times'][-1]:.2f}ms")
    print(f"  Saved to: {output_path}")


if __name__ == "__main__":
    print("="*60)
    print("PDF SIGNATURE EXTRACTION - USAGE EXAMPLES")
    print("="*60)
    
    # Example 1: Process entire PDF
    print("\n[Example 1] Process entire PDF file")
    print("-" * 60)
    pdf_file = "sample.pdf"  # Replace with your PDF path
    if os.path.exists(pdf_file):
        process_pdf_example(pdf_file, output_dir="pdf_output")
    else:
        print(f"⚠ File not found: {pdf_file}")
        print("  Replace 'sample.pdf' with your actual PDF path")
    
    # Example 2: Process single page
    print("\n[Example 2] Process single page from PDF")
    print("-" * 60)
    if os.path.exists(pdf_file):
        process_single_page_example(pdf_file, page_number=1)
    else:
        print(f"⚠ File not found: {pdf_file}")
    
    # Example 3: Process image
    print("\n[Example 3] Process image file")
    print("-" * 60)
    image_file = "assets/images/example_0.jpg"  # Use example image
    if os.path.exists(image_file):
        process_image_example(image_file)
    else:
        print(f"⚠ File not found: {image_file}")
        print("  Replace with your actual image path")
    
    print("\n" + "="*60)
    print("Examples completed!")
    print("="*60)
