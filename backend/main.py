import os
import json
import hashlib
import time
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
from google import genai
from google.genai import types
from groq import Groq

load_dotenv()

app = FastAPI(title="AI-CA Trade Audit - Live RAG Injection")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ai_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Client | None = None
if SUPABASE_URL.startswith("http"):
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

PO_DATABASE = {
    "Dell India": 250000.0,
    "AWS": 25000.0,
    "Reliance Digital": 100000.0,
    "Indigo Airlines": 15000.0
}
SANCTIONED_ENTITIES = ["Apex Gaming Supplies", "Shell Corp Global", "DarkWeb Logistics"]

def calculate_carbon_footprint(line_items: list) -> float:
    total_co2 = 0.0
    for item in line_items:
        desc = str(item.get("description", "")).lower()
        if any(kw in desc for kw in ["laptop", "server", "hardware", "monitor"]):
            total_co2 += 45.5
        elif any(kw in desc for kw in ["flight", "air", "travel"]):
            total_co2 += 150.0
        elif any(kw in desc for kw in ["cloud", "software", "subscription", "saas"]):
            total_co2 += 5.0
        else:
            total_co2 += 1.5
    return total_co2

def compute_sha256(data_string: str) -> str:
    return hashlib.sha256(data_string.encode('utf-8')).hexdigest()

def get_latest_block_hash() -> str:
    if supabase:
        try:
            res = supabase.table("invoices").select("block_hash").order("created_at", desc=True).limit(1).execute()
            if res.data and len(res.data) > 0 and res.data[0].get("block_hash"):
                return res.data[0]["block_hash"]
        except Exception:
            pass
    return "0000000000000000000000000000000000000000000000000000000000000000"

try:
    with open("corporate_policy.md", "r", encoding="utf-8") as f:
        BASE_CORPORATE_POLICY = f.read()
except FileNotFoundError:
    BASE_CORPORATE_POLICY = "No internal policy provided."


@app.post("/upload-invoice/")
async def process_invoice(
    file: UploadFile = File(...), 
    execute_agent: str = Form("false"),
    custom_policy: str = Form("")
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    if not ai_client:
        raise HTTPException(status_code=500, detail="Gemini API key missing.")
        
    try:
        pdf_bytes = await file.read()
        
        active_policy = BASE_CORPORATE_POLICY
        if custom_policy.strip():
            active_policy += f"\n\n--- URGENT OVERRIDE: DYNAMIC POLICY UPDATE ---\n{custom_policy}"
        
        prompt = f"""
        You are an enterprise AI auditor. Analyze this invoice against the provided corporate policy.
        CORPORATE POLICY:
        {active_policy}
        Extract the following fields strictly as a JSON object:
        {{
            "vendor_name": "string",
            "currency": "INR",
            "line_items": [{{"description": "string", "amount": float}}],
            "tax_amount": float,
            "total_amount": float,
            "policy_violations": ["string"]
        }}
        Return ONLY the JSON.
        """
        
        max_retries = 3
        response = None
        
        for attempt in range(max_retries):
            try:
                response = ai_client.models.generate_content(
                    model='gemini-3.6-flash', 
                    contents=[
                        types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf'),
                        prompt
                    ],
                    config=types.GenerateContentConfig(response_mime_type="application/json")
                )
                break 
            except Exception as api_err:
                if "503" in str(api_err) and attempt < max_retries - 1:
                    print(f"Gemini API busy. Retrying in {2 ** attempt} seconds...")
                    time.sleep(2 ** attempt)
                else:
                    class MockResponse:
                        text = """{
                            "vendor_name": "Apex Gaming Supplies", 
                            "currency": "INR", 
                            "line_items": [{"description": "RGB Mechanical Keyboard", "amount": 6200.0}], 
                            "tax_amount": 1980.0, 
                            "total_amount": 12980.0, 
                            "policy_violations": ["API offline. Displaying fallback mock data."]
                        }"""
                    response = MockResponse()
                    break
        
        extracted_data = json.loads(response.text)
        
        line_items = extracted_data.get("line_items") or []
        vendor_name = extracted_data.get("vendor_name") or "UNKNOWN VENDOR"
        currency = extracted_data.get("currency") or "INR"
        
        calculated_subtotal = sum(float(item.get("amount") or 0.0) for item in line_items if isinstance(item, dict))
        tax = float(extracted_data.get("tax_amount") or 0.0)
        reported_total = float(extracted_data.get("total_amount") or 0.0)
        calculated_total = round(calculated_subtotal + tax, 2)
        is_math_valid = abs(calculated_total - reported_total) < 0.02
        
        po_budget = PO_DATABASE.get(vendor_name)
        if po_budget is None:
            po_status = "NO_PO_FOUND"
        elif calculated_total > po_budget:
            po_status = "PO_BUDGET_EXCEEDED"
        else:
            po_status = "PO_APPROVED"

        carbon_footprint = calculate_carbon_footprint(line_items)
        violations = extracted_data.get("policy_violations") or []
        risk_score = 0.0
        fraud_flags = []

        if any(sanctioned.lower() in vendor_name.lower() for sanctioned in SANCTIONED_ENTITIES):
            risk_score += 65.0
            fraud_flags.append(f"CRITICAL: Vendor '{vendor_name}' matches High-Risk Entity database.")

        if 48000.0 <= reported_total < 50000.0 and po_status == "NO_PO_FOUND":
            risk_score += 25.0
            fraud_flags.append("STRUCTURING ALERT: Total positioned just below ₹50,000 threshold limit.")

        if not is_math_valid:
            risk_score += 30.0
            fraud_flags.append("ARITHMETIC BREACH: Line items and tax do not reconcile with total.")

        risk_score = min(round(risk_score, 1), 100.0)
        final_compliant = is_math_valid and (po_status == "PO_APPROVED") and (len(violations) == 0) and (risk_score < 20.0)
        
        if risk_score >= 50.0:
            approval_state = "REJECTED_SECURITY_HOLD"
            status = "BLOCKED_BY_AML"
        elif not final_compliant:
            approval_state = "PENDING_AUDITOR_REVIEW"
            status = "FLAGGED_FOR_REVIEW"
        else:
            approval_state = "AUTO_APPROVED"
            status = "APPROVED"

        payment_strategy = "N/A"
        vendor_email_draft = "N/A"
        
        if execute_agent.lower() == "true":
            if not final_compliant:
                payment_strategy = "HOLD_FUNDS_SECURITY_REVIEW"
            elif reported_total > 100000.0:
                payment_strategy = "NET_30_CAPITAL_PRESERVATION"
            else:
                payment_strategy = "EARLY_PAYMENT_DISCOUNT_ELIGIBLE"

            if not final_compliant:
                remediation_prompt = f"""
                Write a polite, professional email to the vendor '{vendor_name}'.
                The invoice they submitted (Total: {currency} {reported_total}) was flagged by our automated audit system.
                Reasons for flag: {violations}, {fraud_flags}, PO Status: {po_status}.
                Instruct them to correct these issues and resubmit. Sign off as 'AI-CA Autonomous Audit Engine'.
                Return ONLY the email body.
                """
                
                email_success = False
                if groq_client:
                    try:
                        chat_completion = groq_client.chat.completions.create(
                            messages=[{"role": "user", "content": remediation_prompt}],
                            model="llama3-8b-8192", 
                        )
                        vendor_email_draft = chat_completion.choices[0].message.content.strip()
                        email_success = True
                    except Exception:
                        pass

                if not email_success:
                    for attempt in range(max_retries):
                        try:
                            email_response = ai_client.models.generate_content(
                                model='gemini-3.6-flash', contents=remediation_prompt
                            )
                            vendor_email_draft = email_response.text.strip()
                            email_success = True
                            break
                        except Exception as api_err:
                            if "503" in str(api_err) and attempt < max_retries - 1:
                                time.sleep(2 ** attempt)
                            else:
                                break
                
                if not email_success:
                    vendor_email_draft = f"Dear {vendor_name},\nYour invoice ({currency} {reported_total}) was flagged. Please review corporate limits and correct it."

        prev_hash = get_latest_block_hash()
        timestamp = datetime.utcnow().isoformat()
        block_payload = f"{prev_hash}|{vendor_name}|{reported_total}|{calculated_total}|{risk_score}|{timestamp}"
        block_hash = compute_sha256(block_payload)

        audit_record = {
            "vendor_name": vendor_name,
            "currency": currency,
            "reported_total": reported_total,
            "calculated_total": calculated_total,
            "tax_amount": tax,
            "is_compliant": final_compliant,
            "status": status,
            "po_status": po_status,
            "carbon_footprint_kg": carbon_footprint,
            "policy_violations": violations,
            "risk_score": risk_score,
            "fraud_flags": fraud_flags,
            "approval_state": approval_state,
            "prev_hash": prev_hash,
            "block_hash": block_hash,
            "payment_strategy": payment_strategy,
            "vendor_email_draft": vendor_email_draft
        }

        if supabase:
            try:
                supabase.table("invoices").insert(audit_record).execute()
            except Exception as db_err:
                print(f"Supabase write log: {db_err}")

        return {"message": "Audit complete", "audit_record": audit_record}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)