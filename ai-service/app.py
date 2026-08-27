from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime
import logging

from services.ocr_service import OCRService
from services.ner_service import NERService
from services.ddi_service import DDIService

app = Flask(__name__)
CORS(app)

# Initialize services
ocr_service = OCRService()
ner_service = NERService()
ddi_service = DDIService()

logging.basicConfig(level=logging.INFO)

@app.route('/', methods=['GET'])
def service_info():
    return jsonify({
        "service": "MediRemind AI service",
        "status": "healthy",
        "health": "/health",
        "process": "/process-prescription",
    })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/process-prescription', methods=['POST'])
def process_prescription():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        image_file = request.files['image']
        
        # Step 1: OCR - Extract text from image
        ocr_result = ocr_service.process_image(image_file)
        
        if not ocr_result.get('success'):
            return jsonify({"error": "OCR processing failed"}), 500
        
        extracted_text = ocr_result['text']
        
        # Step 2: NER - Extract medical entities
        ner_result = ner_service.extract_entities(extracted_text)
        
        # Step 3: Check for drug interactions
        medications = ner_result.get('medications', [])
        interactions = ddi_service.check_interactions(medications)
        
        # Step 4: Get safety information for each medication
        safety_info = {}
        for medication in medications:
            med_name = medication.get('name')
            if med_name:
                safety_info[med_name] = ddi_service.get_medication_safety_info(med_name)
        
        # Step 5: Structure response
        result = {
            "success": True,
            "extracted_text": extracted_text,
            "medications": medications,
            "doctor_info": ner_result.get('doctor_info', {}),
            "patient_info": ner_result.get('patient_info', {}),
            "interactions": interactions,
            "safety_info": safety_info,
            "confidence": ocr_result.get('confidence', 0.0)
        }
        
        return jsonify(result)
        
    except Exception as e:
        logging.error(f"Error processing prescription: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/check-interactions', methods=['POST'])
def check_interactions():
    """Check interactions for a list of medications"""
    try:
        data = request.json
        medications = data.get('medications', [])
        allergies = data.get('allergies', [])
        
        # Check drug-drug interactions
        interactions = ddi_service.check_interactions(medications)
        
        # Check allergy interactions
        allergy_warnings = ddi_service.check_medication_allergies(medications, allergies)
        
        # Get safety information
        safety_info = {}
        for medication in medications:
            med_name = medication.get('name')
            if med_name:
                safety_info[med_name] = ddi_service.get_medication_safety_info(med_name)
        
        return jsonify({
            "interactions": interactions,
            "allergy_warnings": allergy_warnings,
            "safety_info": safety_info
        })
        
    except Exception as e:
        logging.error(f"Error checking interactions: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route('/suggest-times', methods=['POST'])
def suggest_times():
    """Suggest medication times based on frequency"""
    try:
        data = request.json
        frequency = data.get('frequency', '').lower()
        medications = data.get('medications', [])
        
        suggested_times = []
        
        for med in medications:
            times = suggest_medication_times(med.get('frequency', frequency))
            suggested_times.append({
                'medication': med.get('name'),
                'suggested_times': times
            })
        
        return jsonify({"suggested_times": suggested_times})
        
    except Exception as e:
        logging.error(f"Error suggesting times: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

def suggest_medication_times(frequency):
    """Suggest times based on medication frequency"""
    frequency = frequency.lower()
    
    if 'once' in frequency and 'daily' in frequency:
        return [{"time": "08:00", "dosage": "1 tablet"}]
    elif 'twice' in frequency and 'daily' in frequency:
        return [
            {"time": "08:00", "dosage": "1 tablet"},
            {"time": "20:00", "dosage": "1 tablet"}
        ]
    elif 'three' in frequency or 'thrice' in frequency:
        return [
            {"time": "08:00", "dosage": "1 tablet"},
            {"time": "14:00", "dosage": "1 tablet"},
            {"time": "20:00", "dosage": "1 tablet"}
        ]
    elif 'four' in frequency:
        return [
            {"time": "06:00", "dosage": "1 tablet"},
            {"time": "12:00", "dosage": "1 tablet"},
            {"time": "18:00", "dosage": "1 tablet"},
            {"time": "00:00", "dosage": "1 tablet"}
        ]
    else:
        # Default to twice daily
        return [
            {"time": "08:00", "dosage": "1 tablet"},
            {"time": "20:00", "dosage": "1 tablet"}
        ]

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
