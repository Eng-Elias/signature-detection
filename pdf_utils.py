import io
from typing import List, Union
from PIL import Image
import fitz  # PyMuPDF


class PDFProcessor:
    """Utility class for processing PDF files and converting them to images."""
    
    def __init__(self, dpi: int = 200):
        """
        Initialize the PDF processor.
        
        Args:
            dpi (int): DPI for PDF to image conversion. Higher = better quality but slower.
        """
        self.dpi = dpi
        self.zoom = dpi / 72  # PDF default is 72 DPI
        
    def is_pdf(self, file_path: str) -> bool:
        """
        Check if the file is a PDF.
        
        Args:
            file_path (str): Path to the file.
            
        Returns:
            bool: True if PDF, False otherwise.
        """
        return file_path.lower().endswith('.pdf')
    
    def pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
        """
        Convert PDF pages to PIL Images.
        
        Args:
            pdf_path (str): Path to the PDF file.
            
        Returns:
            List[Image.Image]: List of PIL Images, one per page.
        """
        images = []
        
        try:
            # Open PDF
            pdf_document = fitz.open(pdf_path)
            
            # Convert each page to image
            for page_num in range(len(pdf_document)):
                page = pdf_document[page_num]
                
                # Create matrix for scaling
                mat = fitz.Matrix(self.zoom, self.zoom)
                
                # Render page to pixmap
                pix = page.get_pixmap(matrix=mat, alpha=False)
                
                # Convert pixmap to PIL Image
                img_data = pix.tobytes("png")
                image = Image.open(io.BytesIO(img_data))
                
                images.append(image)
            
            pdf_document.close()
            
        except Exception as e:
            print(f"Error converting PDF to images: {e}")
            raise e
        
        return images
    
    def get_page_count(self, pdf_path: str) -> int:
        """
        Get the number of pages in a PDF.
        
        Args:
            pdf_path (str): Path to the PDF file.
            
        Returns:
            int: Number of pages.
        """
        try:
            pdf_document = fitz.open(pdf_path)
            page_count = len(pdf_document)
            pdf_document.close()
            return page_count
        except Exception as e:
            print(f"Error reading PDF: {e}")
            return 0
    
    def extract_page(self, pdf_path: str, page_number: int) -> Image.Image:
        """
        Extract a specific page from PDF as an image.
        
        Args:
            pdf_path (str): Path to the PDF file.
            page_number (int): Page number (0-indexed).
            
        Returns:
            Image.Image: PIL Image of the page.
        """
        try:
            pdf_document = fitz.open(pdf_path)
            
            if page_number >= len(pdf_document):
                raise ValueError(f"Page {page_number} does not exist in PDF")
            
            page = pdf_document[page_number]
            mat = fitz.Matrix(self.zoom, self.zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            img_data = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_data))
            
            pdf_document.close()
            
            return image
            
        except Exception as e:
            print(f"Error extracting page {page_number}: {e}")
            raise e
