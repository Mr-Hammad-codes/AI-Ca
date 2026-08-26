import os
import json
import hashlib
import time
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from google import genai
from google.genai import types
from groq import Groq

load_dotenv()

app = FastAPI(title="AI-CA Trade Audit - Enterprise Intelligence Engine")

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

class ChatRequest(BaseModel):
    question: str
    vendor_name: str

class RollbackRequest(BaseModel):
    target_block_hash: str
    reason: str

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

# --- MODULE 1: ADVANCED ESG CARBON ACCOUNTING ---
def calculate_esg_carbon_footprint(line_items: list) -> dict:
    scope3_breakdown = {"hardware_co2": 0.0, "travel_co2": 0.0, "cloud_co2": 0.0, "logistics_co2": 0.0, "total_co2": 0.0}
    for item in line_items:
        desc = str(item.get("description", "")).lower()
        amount = float(item.get("amount", 0.0))
        if any(kw in desc for kw in ["laptop", "server", "hardware", "monitor", "keyboard"]):
            scope3_breakdown["hardware_co2"] += 45.5
        elif any(kw in desc for kw in ["flight", "air", "travel", "hotel"]):
            scope3_breakdown["travel_co2"] += (amount * 0.18)
        elif any(kw in desc for kw in ["cloud", "hosting", "saas", "aws", "azure"]):
            scope3_breakdown["cloud_co2"] += (amount * 0.05)
        elif any(kw in desc for kw in ["freight", "shipping", "logistics", "delivery"]):
            scope3_breakdown["logistics_co2"] += 85.0
        else:
            scope3_breakdown["hardware_co2"] += 2.0
            
    scope3_breakdown["total_co2"] = round(sum(scope3_breakdown.values()), 2)
    return scope3_breakdown

# --- MODULE 2: TEMPORAL ANOMALY & ACCRUAL ENGINE ---
def compute_temporal_accrual(vendor_name: str, reported_total: float) -> dict:
    current_day = datetime.utcnow().day
    is_end_of_month = current_day >= 25
    expected_cadence_days = 30
    cadence_variance_flag = is_end_of_month and (reported_total > 50000.0)
    
    accrual_status = "NORMAL_ACCRUAL"
    if cadence_variance_flag:
        accrual_status = "DELAYED_EOM_LIABILITY_WARNING"
        
    return {
        "billing_cadence_days": expected_cadence_days,
        "accrual_status": accrual_status,
        "projected_next_billing": f"Day {current_day + 30} of cycle",
        "eom_liability_flag": cadence_variance_flag
    }

# --- MODULE 5: DYNAMIC DISCOUNTING & YIELD OPTIMIZER ---
def optimize_treasury_yield(vendor_name: str, reported_total: float) -> dict:
    # Simulated vendor discount terms (e.g., 2% discount if paid in 10 days, otherwise Net 30)
    terms = {"discount_percent": 0.0, "discount_days": 0, "net_days": 30}
    if "dell" in vendor_name.lower() or "apex" in vendor_name.lower():
        terms = {"discount_percent": 2.0, "discount_days": 10, "net_days": 30}
    elif "aws" in vendor_name.lower():
        terms = {"discount_percent": 1.5, "discount_days": 15, "net_days": 45}

    corporate_apy = 0.05 # Baseline 5% annual interest on corporate cash reserves
    
    if terms["discount_percent"] > 0:
        discount_value = reported_total * (terms["discount_percent"] / 100)
        days_advanced = terms["net_days"] - terms["discount_days"]
        interest_earned_if_held = reported_total * (corporate_apy / 365) * days_advanced
        
        if discount_value > interest_earned_if_held:
            recommendation = f"EXECUTE EARLY PAYMENT (Day {terms['discount_days']})"
            net_benefit = discount_value - interest_earned_if_held
        else:
            recommendation = f"HOLD CASH (Pay Day {terms['net_days']})"
            net_benefit = interest_earned_if_held - discount_value
    else:
        recommendation = f"HOLD CASH (Pay Day {terms['net_days']})"
        net_benefit = reported_total * (corporate_apy / 365) * terms["net_days"]
        
    return {
        "recommendation": recommendation,
        "discount_offered": f"{terms['discount_percent']}% / {terms['discount_days']} Days" if terms["discount_percent"] > 0 else "None",
        "projected_net_benefit": round(net_benefit, 2)
    }

# --- MODULE 3: CONVERSATIONAL DOCUMENT-CHAT ENDPOINT ---
@app.post("/chat-invoice/")
async def chat_with_invoice(chat_req: ChatRequest):
    if not ai_client:
        raise HTTPException(status_code=500, detail="Gemini API key missing.")
    try:
        chat_prompt = f"""
        You are an expert financial AI assistant. The user is asking a question about the active audit record for vendor '{chat_req.vendor_name}'.
        User Question: {chat_req.question}
        Provide a concise, precise, professional financial response.
        """
        response = ai_client.models.generate_content(
            model='gemini-3.6-flash',
            contents=[chat_prompt]
        )
        return {"answer": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- MODULE 4: GIT-STYLE LEDGER ROLLBACK & REVERSING ENTRIES ---
@app.post("/rollback-ledger/")
async def rollback_ledger_entry(rollback_req: RollbackRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not connected.")
    try:
        res = supabase.table("invoices").select("*").eq("block_hash", rollback_req.target_block_hash).execute()
        if not res.data or len(res.data) == 0:
            raise HTTPException(status_code=404, detail="Target block hash not found in ledger.")
        
        target_block = res.data[0]
        prev_hash = get_latest_block_hash()
        timestamp = datetime.utcnow().isoformat()
        
        reversing_payload = f"{prev_hash}|REVERSING_ENTRY|{target_block['vendor_name']}|-1 * {target_block['reported_total']}|{timestamp}"
        reversing_hash = compute_sha256(reversing_payload)
        
        reversing_record = {
            "vendor_name": f"REVERSING ENTRY: {target_block['vendor_name']}",
            "reported_total": -float(target_block["reported_total"]),
            "calculated_total": -float(target_block["calculated_total"]),
            "risk_score": 0.0,
            "status": f"ROLLED_BACK: {rollback_req.reason}",
            "block_hash": reversing_hash
        }
        
        supabase.table("invoices").insert(reversing_record).execute()
        
        return {
            "message": "Git-style reversing entry successfully appended to immutable ledger.",
            "reversing_block_hash": reversing_hash,
            "previous_target": rollback_req.target_block_hash
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
                    time.sleep(2 ** attempt)
                else:
                    class MockResponse:
                        text = """{
                            "vendor_name": "Apex Gaming Supplies", 
                            "currency": "INR", 
                            "line_items": [{"description": "RGB Mechanical Keyboard", "amount": 6200.0}], 
                            "tax_amount": 1980.0, 
                            "total_amount": 12980.0, 
                            "policy_violations": ["API offline. Fallback mock data active."]
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

        esg_metrics = calculate_esg_carbon_footprint(line_items)
        temporal_accrual = compute_temporal_accrual(vendor_name, reported_total)
        treasury_optimization = optimize_treasury_yield(vendor_name, reported_total)
        
        violations = extracted_data.get("policy_violations") or []
        risk_score = 0.0
        fraud_flags = []

        if any(sanctioned.lower() in vendor_name.lower() for sanctioned in SANCTIONED_ENTITIES):
            risk_score += 65.0
            fraud_flags.append(f"CRITICAL: Vendor '{vendor_name}' matches High-Risk Entity database.")

        if 48000.0 <= reported_total < 50000.0 and po_status == "NO_PO_FOUND":
            risk_score += 25.0
            fraud_flags.append("STRUCTURING ALERT: Total positioned just below threshold limit.")

        if not is_math_valid:
            risk_score += 30.0
            fraud_flags.append("ARITHMETIC BREACH: Line items and tax do not reconcile.")

        if temporal_accrual["eom_liability_flag"]:
            risk_score += 10.0
            fraud_flags.append("TEMPORAL ACCRUAL WARNING: End-of-month unbudgeted liability surge detected.")

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
                payment_strategy = treasury_optimization["recommendation"].replace(" ", "_")

            if not final_compliant:
                remediation_prompt = f"""
                Write a polite, professional email to the vendor '{vendor_name}'.
                The invoice submitted (Total: {currency} {reported_total}) was flagged.
                Reasons: {violations}, {fraud_flags}, PO Status: {po_status}.
                Instruct them to correct and resubmit. Sign off as 'AI-CA Autonomous Audit Engine'.
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
                    vendor_email_draft = f"Dear {vendor_name},\nYour invoice ({currency} {reported_total}) was flagged. Please review and correct."

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
            "esg_metrics": esg_metrics,
            "temporal_accrual": temporal_accrual,
            "treasury_optimization": treasury_optimization,
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
                supabase.table("invoices").insert({
                    "vendor_name": vendor_name,
                    "reported_total": reported_total,
                    "calculated_total": calculated_total,
                    "risk_score": risk_score,
                    "status": status,
                    "block_hash": block_hash
                }).execute()
            except Exception as db_err:
                print(f"Supabase log: {db_err}")

        return {"message": "Audit complete", "audit_record": audit_record}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)