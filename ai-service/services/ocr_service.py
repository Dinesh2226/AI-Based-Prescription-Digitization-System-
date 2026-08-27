import logging
import os
import numpy as np
from PIL import Image
import io
import torch
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

class OCRService:
    def __init__(self):
        self.processor = None
        self.model = None
        self.model_name = None
        self.printed_processor = None
        self.printed_model = None
        self.load_model()
    
    def load_model(self):
        """Load TrOCR model for prescription text recognition"""
        try:
            model_name = os.getenv('OCR_MODEL', 'microsoft/trocr-base-handwritten')
            self.processor = TrOCRProcessor.from_pretrained(model_name)
            self.model = VisionEncoderDecoderModel.from_pretrained(model_name)
            self.model_name = model_name
            logging.info("TrOCR model loaded successfully: %s", model_name)
        except Exception as e:
            logging.error(f"Error loading TrOCR model: {str(e)}")
    
    def process_image(self, image_file):
        """Process prescription image and extract text"""
        try:
            # TrOCR is a line recognizer. Split a full-page prescription into
            # overlapping horizontal bands so handwritten medicine lines are not
            # discarded when the whole page is passed as one image.
            image = Image.open(io.BytesIO(image_file.read())).convert('RGB')
            crops = self._line_crops(image)

            extracted_text = self._recognize(crops, self.processor, self.model)

            # Printed prescriptions are common and the handwritten checkpoint
            # can return almost no text for them. Retry with the printed model
            # only when needed, keeping normal handwritten uploads fast.
            if len(extracted_text.strip()) < 20 and 'printed' not in (self.model_name or ''):
                if self.printed_model is None:
                    self.printed_processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-printed')
                    self.printed_model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-printed')
                printed_text = self._recognize(crops, self.printed_processor, self.printed_model)
                if len(printed_text.strip()) > len(extracted_text.strip()):
                    extracted_text = printed_text
            
            return {
                "success": True,
                "text": extracted_text,
                "confidence": 0.85  # Simulated confidence score
            }
            
        except Exception as e:
            logging.error(f"OCR processing error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    def _recognize(crops, processor, model):
        pixel_values = processor(images=crops, return_tensors="pt").pixel_values
        with torch.inference_mode():
            generated_ids = model.generate(pixel_values, max_new_tokens=32, num_beams=1)
        decoded = processor.batch_decode(generated_ids, skip_special_tokens=True)
        return '\n'.join(text.strip() for text in decoded if text.strip())

    @staticmethod
    def _line_crops(image):
        """Find ink-heavy horizontal rows; TrOCR performs best on line crops."""
        width, height = image.size
        gray = np.asarray(image.convert('L'))
        dark = (gray < 175).sum(axis=1)
        active = dark > max(8, int(width * 0.008))
        groups = []
        start = None
        for index, is_active in enumerate(active):
            if is_active and start is None:
                start = index
            elif not is_active and start is not None:
                if index - start >= 3:
                    groups.append((max(0, start - 14), min(height, index + 14)))
                start = None
        if start is not None:
            groups.append((max(0, start - 14), height))

        # Keep nearby row centers separate. Handwritten medicine lines often
        # overlap slightly in their ink projections; merging them would turn
        # four line crops into one paragraph that TrOCR cannot decode.
        distinct = []
        for top, bottom in groups:
            center = (top + bottom) // 2
            if distinct and center - distinct[-1][2] < 24:
                continue
            distinct.append((top, bottom, center))
        candidates = [(top, bottom) for top, bottom, _ in distinct if bottom - top >= 28]
        if len(candidates) <= 8:
            return [image.crop((0, top, width, bottom)) for top, bottom in candidates] or [image]

        # Prefer the central prescription body, where medicine rows usually
        # live. This avoids dropping lighter handwritten rows just because a
        # header, watermark, or signature has more dark pixels.
        body = [item for item in candidates if 0.30 <= ((item[0] + item[1]) / 2) / height <= 0.78]
        pool = body if len(body) >= 4 else candidates
        if len(pool) <= 12:
            pool.sort(key=lambda item: item[0])
            return [image.crop((0, top, width, bottom)) for top, bottom in pool]
        scored = [(float(dark[top:bottom].sum()), top, bottom) for top, bottom in pool]
        selected = sorted(scored, reverse=True)[:8]
        selected.sort(key=lambda item: item[1])
        return [image.crop((0, top, width, bottom)) for _, top, bottom in selected]

    def preprocess_image(self, image):
        """Preprocess image for better OCR results"""
        # Convert to grayscale
        image = image.convert('L')
        
        # Enhance contrast (simple histogram equalization)
        import numpy as np
        img_array = np.array(image)
        
        # Simple contrast stretching
        p2, p98 = np.percentile(img_array, (2, 98))
        img_array = np.clip((img_array - p2) * 255.0 / (p98 - p2), 0, 255).astype(np.uint8)
        
        return Image.fromarray(img_array)
