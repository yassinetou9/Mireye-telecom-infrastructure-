import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from mireye_client import MireyeClient

app = FastAPI(
    title="Telecom Infrastructure Scouting Pipeline",
    description="Automated FastAPI backend to evaluate physical-world site coordinates for telecom towers and data centers.",
    version="1.0.0"
)

# Enable CORS so the React frontend can query this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for seamless developer experience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Mireye client
mireye_client = MireyeClient()

class EvaluationRequest(BaseModel):
    lat: float = Field(..., description="Latitude of the candidate site (-90.0 to 90.0)", json_schema_extra={"example": 37.7749})
    lng: float = Field(..., description="Longitude of the candidate site (-180.0 to 180.0)", json_schema_extra={"example": -122.4194})

class EvaluationResponse(BaseModel):
    decision: str = Field(..., description="The scouting result: APPROVED, WARNING, or REJECTED")
    reasons: list[str] = Field(..., description="List of justifications driving the decision")
    telemetry: dict = Field(..., description="Physical parameters parsed from Mireye")
    citations: list[dict] = Field(..., description="FEMA, USGS, or Mireye source metadata")
    coordinates: dict = Field(..., description="Echoed input coordinate values")

@app.get("/api/health")
def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy", "service": "scouting-pipeline-backend"}

@app.post("/api/evaluate", response_model=EvaluationResponse, status_code=status.HTTP_200_OK)
def evaluate_site(request: EvaluationRequest):
    """
    Evaluates candidate site coordinates for cell towers or data centers.
    Applies strict physical-world business logic to Mireye radar/geospatial telemetry.
    """
    # Validate coordinate bounds
    if not (-90.0 <= request.lat <= 90.0):
        raise HTTPException(status_code=400, detail="Latitude must be between -90.0 and 90.0 degrees.")
    if not (-180.0 <= request.lng <= 180.0):
        raise HTTPException(status_code=400, detail="Longitude must be between -180.0 and 180.0 degrees.")

    # Fetch physical-world telemetry from Mireye API (or deterministic fallback)
    data = mireye_client.fetch_site_telemetry(request.lat, request.lng)

    elevation = data["elevation"]
    slope = data["slope"]
    flood_zone = data["flood_zone"]
    vegetation = data["vegetation"]
    citations = data["citations"]

    # Implement User Business Logic
    # 1. If Flood Risk is "A", "AE", "V", or "VE" -> decision = "REJECTED" (Reason: High FEMA Flood Risk)
    # 2. If Slope > 15% -> decision = "WARNING" (Reason: Steep terrain, high grading cost)
    # 3. Otherwise -> decision = "APPROVED" (Reason: Site is stable, elevation optimal for Line of Sight)
    
    reasons = []
    
    # Check Flood Risk
    is_high_flood_risk = flood_zone in ["A", "AE", "V", "VE"]
    
    if is_high_flood_risk:
        decision = "REJECTED"
        reasons.append(f"High FEMA Flood Risk: Candidate coordinates reside within high-risk flood zone '{flood_zone}'.")
    elif slope > 15.0:
        decision = "WARNING"
        reasons.append(f"Steep terrain identified (Slope is {slope}%): Exceeds standard construction safety grading baseline (>15%). Will incur high civil engineering and earthwork/grading costs.")
    else:
        decision = "APPROVED"
        reasons.append(f"Optimal topographic profile: Site is stable (Slope is {slope}%), situated outside high-risk flood basins (Zone '{flood_zone}'), and offers excellent Line-of-Sight potential with elevation of {elevation}m.")

    # Optional secondary metrics to add more technical rigor:
    if elevation < 10.0:
        reasons.append(f"Caution: Low elevation profile ({elevation}m). May require supplementary height extension masts for direct line-of-sight propagation.")
    elif elevation > 1000.0:
        reasons.append(f"Note: Mountainous or high-altitude setting ({elevation}m). Excellent coverage spread potential; consider winter icing risk countermeasures.")

    if "Dense" in vegetation or "Forest" in vegetation:
        reasons.append(f"Environmental advisory: '{vegetation}' present. Microwave link planning must account for tree-canopy attenuation and potential clearing permits.")

    # Return the structured payload
    return EvaluationResponse(
        decision=decision,
        reasons=reasons,
        telemetry={
            "elevation": elevation,
            "slope": slope,
            "flood_zone": flood_zone,
            "vegetation": vegetation,
            "simulated": data.get("simulated", False)
        },
        citations=citations,
        coordinates={
            "latitude": request.lat,
            "longitude": request.lng
        }
    )

if __name__ == "__main__":
    # Start on Port 8000 when executed directly
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
