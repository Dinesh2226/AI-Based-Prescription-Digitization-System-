import logging
import requests
import json
from typing import List, Dict, Any

class DDIService:
    def __init__(self):
        self.interaction_db = self._load_interaction_database()
        self.rxnorm_api_base = "https://rxnav.nlm.nih.gov/REST"
        
    def _load_interaction_database(self) -> Dict[str, List[Dict]]:
        """Load known drug-drug interactions database"""
        # This is a simplified static database
        # In production, use RxNorm API or other professional databases
        return {
            "simvastatin": [
                {
                    "with_medication": "clarithromycin",
                    "severity": "high",
                    "description": "Increased risk of muscle toxicity and rhabdomyolysis",
                    "recommendation": "Avoid concurrent use or monitor closely for muscle pain/weakness"
                },
                {
                    "with_medication": "warfarin",
                    "severity": "moderate",
                    "description": "May increase anticoagulant effect",
                    "recommendation": "Monitor INR more frequently"
                }
            ],
            "warfarin": [
                {
                    "with_medication": "aspirin",
                    "severity": "high",
                    "description": "Increased risk of bleeding",
                    "recommendation": "Avoid concurrent use or monitor for bleeding signs"
                },
                {
                    "with_medication": "ibuprofen",
                    "severity": "moderate",
                    "description": "Increased bleeding risk",
                    "recommendation": "Use alternative pain reliever if possible"
                }
            ],
            "lisinopril": [
                {
                    "with_medication": "ibuprofen",
                    "severity": "moderate",
                    "description": "Reduced antihypertensive effect, risk of kidney impairment",
                    "recommendation": "Monitor blood pressure and kidney function"
                }
            ],
            "metformin": [
                {
                    "with_medication": "alcohol",
                    "severity": "moderate",
                    "description": "Increased risk of lactic acidosis",
                    "recommendation": "Avoid excessive alcohol consumption"
                }
            ]
        }
    
    def check_interactions(self, medications: List[Dict]) -> List[Dict]:
        """
        Check for drug-drug interactions between provided medications
        
        Args:
            medications: List of medication dictionaries with 'name' key
            
        Returns:
            List of interaction warnings
        """
        try:
            interactions = []
            medication_names = [med.get('name', '').lower() for med in medications]
            
            # Remove duplicates and empty names
            medication_names = list(set([name for name in medication_names if name]))
            
            if len(medication_names) < 2:
                return interactions
            
            # Check each pair of medications
            for i, med1 in enumerate(medication_names):
                for j, med2 in enumerate(medication_names):
                    if i >= j:  # Avoid duplicate pairs and self-comparison
                        continue
                    
                    # Check both directions
                    interaction = self._check_single_interaction(med1, med2)
                    if interaction:
                        interactions.append(interaction)
                    
                    interaction = self._check_single_interaction(med2, med1)
                    if interaction and not self._interaction_exists(interactions, interaction):
                        interactions.append(interaction)
            
            # Try to get more accurate interactions using RxNorm if available
            if medications:
                rxnorm_interactions = self._check_rxnorm_interactions(medications)
                interactions.extend(rxnorm_interactions)
            
            return interactions
            
        except Exception as e:
            logging.error(f"Error checking interactions: {str(e)}")
            return []
    
    def _check_single_interaction(self, med1: str, med2: str) -> Dict:
        """Check interaction between two specific medications"""
        if med1 in self.interaction_db:
            for interaction in self.interaction_db[med1]:
                if med2.lower() in interaction['with_medication'].lower():
                    return {
                        "medication1": med1.capitalize(),
                        "medication2": med2.capitalize(),
                        "severity": interaction['severity'],
                        "description": interaction['description'],
                        "recommendation": interaction['recommendation'],
                        "source": "local_database"
                    }
        return None
    
    def _interaction_exists(self, interactions: List[Dict], new_interaction: Dict) -> bool:
        """Check if interaction already exists in the list"""
        for interaction in interactions:
            if (interaction['medication1'] == new_interaction['medication1'] and 
                interaction['medication2'] == new_interaction['medication2']):
                return True
            if (interaction['medication1'] == new_interaction['medication2'] and 
                interaction['medication2'] == new_interaction['medication1']):
                return True
        return False
    
    def _check_rxnorm_interactions(self, medications: List[Dict]) -> List[Dict]:
        """
        Check interactions using RxNorm API
        This provides more accurate and comprehensive interaction data
        """
        try:
            interactions = []
            
            # Get RxNorm IDs for medications
            rxnorm_ids = []
            for med in medications:
                rxcui = self._get_rxnorm_id(med.get('name', ''))
                if rxcui:
                    rxnorm_ids.append(rxcui)
            
            if len(rxnorm_ids) < 2:
                return interactions
            
            # Check interactions via RxNorm API
            for i, rxcui1 in enumerate(rxnorm_ids):
                for j, rxcui2 in enumerate(rxnorm_ids):
                    if i >= j:
                        continue
                    
                    interaction = self._get_rxnorm_interaction(rxcui1, rxcui2)
                    if interaction:
                        interactions.append(interaction)
            
            return interactions
            
        except Exception as e:
            logging.warning(f"RxNorm interaction check failed: {str(e)}")
            return []
    
    def _get_rxnorm_id(self, medication_name: str) -> str:
        """
        Get RxNorm Concept Unique Identifier (RXCUI) for a medication
        """
        try:
            url = f"{self.rxnorm_api_base}/rxcui.json"
            params = {
                "name": medication_name,
                "search": 2  # approximate term matching
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if 'idGroup' in data and 'rxnormId' in data['idGroup']:
                    return data['idGroup']['rxnormId'][0]
            
            return None
            
        except Exception as e:
            logging.debug(f"Could not get RxNorm ID for {medication_name}: {str(e)}")
            return None
    
    def _get_rxnorm_interaction(self, rxcui1: str, rxcui2: str) -> Dict:
        """
        Get interaction details from RxNorm API for two RXCUIs
        """
        try:
            url = f"{self.rxnorm_api_base}/interaction/list.json"
            params = {
                "rxcuis": f"{rxcui1}+{rxcui2}"
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return self._parse_rxnorm_interaction(data, rxcui1, rxcui2)
            
            return None
            
        except Exception as e:
            logging.debug(f"RxNorm interaction API call failed: {str(e)}")
            return None
    
    def _parse_rxnorm_interaction(self, api_data: Dict, rxcui1: str, rxcui2: str) -> Dict:
        """
        Parse RxNorm API response into standardized interaction format
        """
        try:
            if 'fullInteractionTypeGroup' not in api_data:
                return None
            
            interaction_groups = api_data['fullInteractionTypeGroup']
            
            for group in interaction_groups:
                for interaction_type in group.get('fullInteractionType', []):
                    # Get the first interaction pair
                    for interaction_pair in interaction_type.get('interactionPair', []):
                        severity = self._map_severity(interaction_pair.get('severity', 'N/A'))
                        
                        return {
                            "medication1": self._get_medication_name(rxcui1),
                            "medication2": self._get_medication_name(rxcui2),
                            "severity": severity,
                            "description": interaction_pair.get('description', 'Potential interaction detected'),
                            "recommendation": "Consult your healthcare provider",
                            "source": "rxnorm_api"
                        }
            
            return None
            
        except Exception as e:
            logging.error(f"Error parsing RxNorm interaction: {str(e)}")
            return None
    
    def _get_medication_name(self, rxcui: str) -> str:
        """
        Get medication name from RxNorm ID
        """
        try:
            url = f"{self.rxnorm_api_base}/rxcui/{rxcui}/properties.json"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                return data.get('properties', {}).get('name', f"Medication_{rxcui}")
            return f"Medication_{rxcui}"
        except:
            return f"Medication_{rxcui}"
    
    def _map_severity(self, rxnorm_severity: str) -> str:
        """Map RxNorm severity to our standardized levels"""
        severity_map = {
            'high': 'high',
            'medium': 'moderate',
            'moderate': 'moderate',
            'low': 'low',
            'n/a': 'unknown'
        }
        return severity_map.get(rxnorm_severity.lower(), 'unknown')
    
    def check_medication_allergies(self, medications: List[Dict], allergies: List[str]) -> List[Dict]:
        """
        Check for potential allergy interactions
        """
        try:
            warnings = []
            medication_names = [med.get('name', '').lower() for med in medications]
            
            for allergy in allergies:
                allergy_lower = allergy.lower()
                
                # Simple substring matching (in production, use more sophisticated matching)
                for med_name in medication_names:
                    if allergy_lower in med_name or self._is_similar_allergy(med_name, allergy_lower):
                        warnings.append({
                            "type": "allergy",
                            "medication": med_name.capitalize(),
                            "allergy": allergy,
                            "severity": "high",
                            "description": f"Medication may contain or be related to known allergen: {allergy}",
                            "recommendation": "Consult healthcare provider immediately"
                        })
            
            return warnings
            
        except Exception as e:
            logging.error(f"Error checking allergies: {str(e)}")
            return []
    
    def _is_similar_allergy(self, medication: str, allergy: str) -> bool:
        """
        Basic similarity check between medication and allergy
        In production, use more advanced NLP techniques
        """
        # Common drug classes that might share allergy concerns
        drug_classes = {
            'penicillin': ['amoxicillin', 'ampicillin', 'penicillin'],
            'sulfa': ['sulfamethoxazole', 'sulfasalazine', 'sulfa'],
            'nsaid': ['ibuprofen', 'naproxen', 'aspirin', 'nsaid'],
            'statin': ['simvastatin', 'atorvastatin', 'rosuvastatin', 'statin']
        }
        
        for drug_class, members in drug_classes.items():
            if allergy in drug_class and any(member in medication for member in members):
                return True
            if medication in drug_class and any(member in allergy for member in members):
                return True
        
        return False
    
    def get_medication_safety_info(self, medication_name: str) -> Dict:
        """
        Get general safety information for a medication
        """
        safety_info = {
            "common_side_effects": [],
            "precautions": [],
            "monitoring_parameters": []
        }
        
        # Simplified safety database
        safety_db = {
            "simvastatin": {
                "common_side_effects": ["Muscle pain", "Headache", "Nausea"],
                "precautions": ["Avoid grapefruit juice", "Report unexplained muscle pain"],
                "monitoring_parameters": ["Liver function tests", "Cholesterol levels"]
            },
            "warfarin": {
                "common_side_effects": ["Bleeding", "Bruising", "Hair loss"],
                "precautions": ["Monitor INR regularly", "Maintain consistent vitamin K intake"],
                "monitoring_parameters": ["INR", "Signs of bleeding"]
            },
            "metformin": {
                "common_side_effects": ["Diarrhea", "Nausea", "Stomach upset"],
                "precautions": ["Take with food", "Watch for symptoms of lactic acidosis"],
                "monitoring_parameters": ["Kidney function", "Blood glucose"]
            }
        }
        
        med_key = medication_name.lower()
        for key in safety_db:
            if key in med_key:
                return safety_db[key]
        
        return safety_info