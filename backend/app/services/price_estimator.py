"""Estimate prices for cosmetic procedures."""
import csv
import os


# Load pricing data from CSV if available, otherwise use defaults
PROCEDURE_PRICES = {}


def _load_pricing_data():
    """Load pricing data from data/pricing.csv if it exists."""
    global PROCEDURE_PRICES
    
    pricing_csv = os.path.join(os.path.dirname(__file__), "..", "..", "data", "pricing.csv")
    
    if os.path.exists(pricing_csv):
        try:
            with open(pricing_csv, "r") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    procedure = row.get("procedure", "").strip()
                    price = row.get("price", "0")
                    if procedure:
                        try:
                            PROCEDURE_PRICES[procedure] = float(price)
                        except ValueError:
                            pass
        except Exception as e:
            print(f"Error loading pricing CSV: {e}")
    
    # Fallback prices if CSV not found or procedure not in CSV
    if not PROCEDURE_PRICES:
        PROCEDURE_PRICES.update({
            "Botox (Forehead)": 400,
            "Botox (Right Eye)": 350,
            "Botox (Left Eye)": 350,
            "Botox (Mouth)": 300,
            "Botox (Masseter)": 400,
            "Botox (Chin)": 250,
            "Fillers (Forehead)": 600,
            "Fillers (Right Eye)": 500,
            "Fillers (Left Eye)": 500,
            "Fillers (Nose)": 550,
            "Fillers (Jawline)": 650,
            "Cheek Fillers": 700,
            "Lip Fillers": 600,
            "Chin Fillers": 500,
            "Rhinoplasty": 8000,
            "Jaw Contouring": 5000,
            "Cheek Implants": 6000,
            "Chin Augmentation": 4500,
            "Eyelid Lift": 5500,
            "Smile Lift": 3500,
            "Microdermabrasion": 400,
        })


# Load pricing data on module import
_load_pricing_data()


def estimate_prices(procedures: list) -> list:
    """
    Add price estimates to recommended procedures.
    
    Args:
        procedures: List of procedures from map_procedures()
    
    Returns:
        List of procedures with added 'price' and 'total_price' fields
    """
    total_package_price = 0
    priced_procedures = []
    
    for proc in procedures:
        proc_name = proc.get("procedure", "")
        # Get price from PROCEDURE_PRICES, default to 500 if not found
        price = PROCEDURE_PRICES.get(proc_name, 500)
        
        proc_copy = proc.copy()
        proc_copy["price"] = float(price)
        priced_procedures.append(proc_copy)
        total_package_price += price
    
    # Add package discount (5% off if multiple procedures)
    if len(priced_procedures) > 1:
        discount = total_package_price * 0.05
        total_package_price -= discount
        package_info = {
            "type": "package",
            "procedures_count": len(priced_procedures),
            "subtotal": sum(p["price"] for p in priced_procedures),
            "discount": discount,
            "total": total_package_price,
        }
    else:
        package_info = {
            "type": "single" if priced_procedures else "none",
            "total": total_package_price,
        }
    
    return {
        "procedures": priced_procedures,
        "package_summary": package_info,
    }
