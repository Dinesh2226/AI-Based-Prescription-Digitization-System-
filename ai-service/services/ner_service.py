import re
import logging
from datetime import datetime

class NERService:
    NON_MEDICATION_WORDS = {
        'see', 'to', 'the', 'and', 'or', 'name', 'date', 'age', 'address',
        'patient', 'medical', 'centre', 'center', 'clinic', 'hospital',
        'example', 'street', 'st', 'ny', 'rate', 'weight', 'doctor',
    }

    def __init__(self):
        self.medication_patterns = self._load_medication_patterns()
        self.doctor_patterns = self._load_doctor_patterns()
    
    def _load_medication_patterns(self):
        """Load patterns for medication extraction"""
        return {
            'medication_name': r'\b(?:Take|Use|Apply)\s+([A-Za-z\s]+?)\s*(?:\d+mg|\d+\.\d+mg|\d+\s*mg|tablet|capsule|injection)',
            'dosage': r'(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|tablets?|capsules?|puffs?|drops?))',
            'frequency': r'(?:once|twice|three times|four times)\s*(?:a|per)\s*(?:day|daily|week|month)',
            'duration': r'(?:for|duration of)\s*(\d+\s*(?:days?|weeks?|months?|years?))',
            'instructions': r'(?:take|use)\s*(?:with|without)\s*(?:food|meals?|water)'
        }
    
    def _load_doctor_patterns(self):
        """Load patterns for doctor information extraction"""
        return {
            'doctor_name': r'Dr\.?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)',
            'clinic': r'(?:Clinic|Hospital|Medical Center|Health Center)\s*[:]?\s*([^\n,]+)',
            'license': r'License\s*[:]?\s*([A-Z0-9-]+)'
        }
    
    def extract_entities(self, text):
        """Extract medical entities from prescription text"""
        try:
            result = {
                'medications': [],
                'doctor_info': {},
                'patient_info': {},
                'date_info': {}
            }
            
            # Extract medications
            result['medications'] = self._extract_medications(text)
            
            # Extract doctor information
            result['doctor_info'] = self._extract_doctor_info(text)
            
            # Extract dates
            result['date_info'] = self._extract_dates(text)
            
            return result
            
        except Exception as e:
            logging.error(f"Error in NER extraction: {str(e)}")
            return {'medications': [], 'doctor_info': {}, 'patient_info': {}, 'date_info': {}}
    
    def _extract_medications(self, text):
        """Extract medication information from text"""
        medications = []
        
        # Simple rule-based extraction (in production, use trained ML model)
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            medication = self._parse_medication_line(line)
            if medication and medication.get('name', '').strip().lower() not in self.NON_MEDICATION_WORDS:
                medications.append(medication)
        
        # If no medications found with detailed parsing, try simple pattern
        if not medications:
            medications = self._fallback_medication_extraction(text)
        
        return medications
    
    def _parse_medication_line(self, line):
        """Parse a single line for medication information"""
        medication = {}

        # Printed prescription tables often put the medicine name in its own
        # column, separate from dose and duration. Capture that row instead of
        # requiring a dosage token on the same line.
        table_match = re.match(
            r'^\s*(?:\d+[.)]\s*)?(?:tab(?:let)?|cap(?:sule)?|syp(?:rup)?|inj(?:ection)?)\.?\s+(.+?)\s*$',
            line,
            re.IGNORECASE,
        )
        if table_match:
            name = re.split(r'\s{2,}', table_match.group(1).strip())[0]
            if len(name) >= 3:
                return {
                    'name': name,
                    'dosage': 'As prescribed',
                    'frequency': self._extract_frequency(line),
                    'instructions': line.strip(),
                }
        
        # Common medication patterns
        med_patterns = [
            r'(\b[A-Z][a-z]+\b)\s+(\d+\s*mg)\s+(.*?)(?:\n|$)',
            r'(\b[A-Z][a-z]+\b)\s+(tablets?|capsules?)\s+(.*?)(?:\n|$)',
            r'(\b[A-Z][a-z]+\b)\s+(\d+)\s*(?:mg)?\s*(.*?)(?:\n|$)'
        ]
        
        for pattern in med_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                medication['name'] = match.group(1)
                if 'mg' in match.group(2).lower() or 'tablet' in match.group(2).lower():
                    medication['dosage'] = match.group(2)
                else:
                    medication['dosage'] = match.group(2) + ' mg'
                
                # Extract frequency from instructions
                instructions = match.group(3) if len(match.groups()) > 2 else ''
                medication['frequency'] = self._extract_frequency(instructions)
                medication['instructions'] = instructions.strip()
                
                return medication
        
        return None
    
    def _extract_frequency(self, text):
        """Extract frequency information from text"""
        frequency_patterns = {
            'once daily': r'(once\s*(?:a|per)\s*(?:day|daily))',
            'twice daily': r'(twice\s*(?:a|per)\s*(?:day|daily))',
            'three times daily': r'(three\s*times\s*(?:a|per)\s*(?:day|daily))',
            'four times daily': r'(four\s*times\s*(?:a|per)\s*(?:day|daily))',
            'as needed': r'(as\s+needed|when\s+required)'
        }
        abbreviation_patterns = {
            'twice daily': r'\b(?:bid|b\.i\.d\.)\b',
            'three times daily': r'\b(?:tid|td|t\.i\.d\.|t\.d\.)\b',
            'four times daily': r'\b(?:qid|q\.i\.d\.)\b',
            'once daily': r'\b(?:qd|q\.d\.)\b',
        }
        
        for freq_name, pattern in frequency_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                return freq_name
        for freq_name, pattern in abbreviation_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                return freq_name
        
        return 'once daily'  # Default
    
    def _fallback_medication_extraction(self, text):
        """Fallback method for medication extraction"""
        medications = []
        
        # Common medication names (simplified)
        common_meds = [
            'Simvastatin', 'Atorvastatin', 'Metformin', 'Lisinopril',
            'Levothyroxine', 'Amlodipine', 'Metoprolol', 'Omeprazole',
            'Losartan', 'Albuterol', 'Warfarin', 'Aspirin',
            'Betaloc', 'Dorzolamide', 'Cimetidine', 'Oxprelol'
        ]
        
        for med in common_meds:
            if med.lower() in text.lower():
                medications.append({
                    'name': med,
                    'dosage': 'As prescribed',
                    'frequency': 'once daily',
                    'instructions': 'Take as directed'
                })
        
        return medications
    
    def _extract_doctor_info(self, text):
        """Extract doctor information"""
        doctor_info = {}
        
        # Doctor name
        name_match = re.search(r'Dr\.?\s*([A-Z][a-z]+\s+[A-Z][a-z]+)', text)
        if name_match:
            doctor_info['name'] = name_match.group(1)
        
        # Clinic/Hospital
        clinic_match = re.search(r'(?:Clinic|Hospital|Medical Center)\s*[:]?\s*([^\n,]+)', text)
        if clinic_match:
            doctor_info['clinic'] = clinic_match.group(1)
        
        return doctor_info
    
    def _extract_dates(self, text):
        """Extract date information"""
        date_info = {}
        
        # Date patterns
        date_pattern = r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})'
        match = re.search(date_pattern, text)
        if match:
            date_info['prescription_date'] = match.group(1)
        
        return date_info
