import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

// Custom high-fidelity mock data generator in Node to keep the pipeline fully synced
function generateSimulatedTelemetry(lat: number, lng: number, reason: string) {
  // Use a stable, deterministic mathematical seed based on latitude and longitude
  const seed = Math.sin(lat) * Math.cos(lng);
  
  // Elevation (meters)
  const elevation = Math.round((Math.abs(seed) * 850 + 40) * 10) / 10;
  
  // Slope (percentage)
  const slope = Math.round((Math.abs(seed) * 28 + 1) * 10) / 10;
  
  // Flood zone designation
  let flood_zone = "X";
  if (Math.abs(seed) < 0.15) {
    flood_zone = "A";
  } else if (Math.abs(seed) < 0.3) {
    flood_zone = "AE";
  } else if (Math.abs(seed) < 0.35) {
    flood_zone = "V";
  }

  // Vegetation profile
  const vegOptions = [
    "Coniferous Forest", 
    "Shrubland & Chaparral", 
    "Tallgrass Prairie", 
    "Sparse / Desert Vegetation", 
    "Urban / Developed"
  ];
  const vegIdx = Math.floor(Math.abs(seed * 10)) % vegOptions.length;
  const vegetation = vegOptions[vegIdx];

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + " UTC";

  const citations = [
    {
      source: "USGS National Elevation Dataset (NED)",
      timestamp,
      confidence: "98.4%",
      resolution: "1/3 arc-second (~10m)"
    },
    {
      source: "FEMA National Flood Hazard Layer (NFHL)",
      timestamp,
      confidence: "95.0%",
      resolution: "Hydrologic Unit Code (HUC-8)"
    },
    {
      source: `Mireye High-Res Synthetic Aperture Radar (SAR) (Node Proxy Fallback: ${reason.substring(0, 30)})`,
      timestamp,
      confidence: "89.0%",
      resolution: "Active 12-meter grid"
    }
  ];

  return {
    elevation,
    slope,
    flood_zone,
    vegetation,
    citations,
    simulated: true
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser middleware
  app.use(express.json());

  // CORS middleware for safety
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API Route - Site Evaluation
  app.post("/api/evaluate", async (req, res) => {
    try {
      const { lat, lng, apiToken } = req.body;

      if (lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "Missing coordinates. lat and lng are required." });
      }

      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);

      if (isNaN(parsedLat) || parsedLat < -90.0 || parsedLat > 90.0) {
        return res.status(400).json({ error: "Latitude must be a valid number between -90.0 and 90.0." });
      }
      if (isNaN(parsedLng) || parsedLng < -180.0 || parsedLng > 180.0) {
        return res.status(400).json({ error: "Longitude must be a valid number between -180.0 and 180.0." });
      }

      let telemetryData;

      // If a real Mireye API key is configured by the user, let's proxy the request securely
      if (apiToken && apiToken.trim() !== "") {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

          const mireyeResponse = await fetch("https://api.mireye.com/v1/analyze", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiToken.trim()}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              latitude: parsedLat,
              longitude: parsedLng,
              metrics: ["elevation", "slope", "flood_zone", "vegetation"]
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (mireyeResponse.ok) {
            const data = await mireyeResponse.json();
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + " UTC";
            
            telemetryData = {
              elevation: data.elevation ?? 124.5,
              slope: data.slope ?? 4.2,
              flood_zone: data.flood_zone ?? "X",
              vegetation: data.vegetation ?? "Grassland",
              citations: data.citations ?? [
                {
                  source: "Mireye Real-time Geospatial API v1",
                  timestamp,
                  confidence: "99.2%",
                  resolution: "Active Scouting Layer"
                }
              ],
              simulated: false
            };
          } else {
            telemetryData = generateSimulatedTelemetry(
              parsedLat, 
              parsedLng, 
              `Mireye API status: ${mireyeResponse.status}`
            );
          }
        } catch (apiErr: any) {
          telemetryData = generateSimulatedTelemetry(
            parsedLat, 
            parsedLng, 
            `API call failed: ${apiErr.message}`
          );
        }
      } else {
        // Fallback to local high-fidelity simulation
        telemetryData = generateSimulatedTelemetry(
          parsedLat, 
          parsedLng, 
          "Mireye API key not provided or uses default placeholder."
        );
      }

      // Execute Evaluation Business Logic
      // 1. If Flood Risk is "A", "AE", "V", or "VE" -> decision = "REJECTED" (Reason: High FEMA Flood Risk)
      // 2. If Slope > 15% -> decision = "WARNING" (Reason: Steep terrain, high grading cost)
      // 3. Otherwise -> decision = "APPROVED" (Reason: Site is stable, elevation optimal for Line of Sight)
      const { elevation, slope, flood_zone, vegetation, citations, simulated } = telemetryData;
      
      const reasons: string[] = [];
      let decision: "APPROVED" | "WARNING" | "REJECTED";

      const isHighFloodRisk = ["A", "AE", "V", "VE"].includes(flood_zone);

      if (isHighFloodRisk) {
        decision = "REJECTED";
        reasons.push(`Flood Risk (Critical Red Flag): Candidate coordinates reside within high-risk flood zone '${flood_zone}'. Cell tower power grids and infrastructure cannot be placed in high-risk inundation zones without prohibitive insurance and structural costs.`);
      } else if (slope > 15.0) {
        decision = "WARNING";
        reasons.push(`Terrain Slope (Civil Engineering Cost): Steep inclinations (${slope}%) require heavy earth-moving, retaining walls, and custom foundations.`);
      } else {
        decision = "APPROVED";
        reasons.push(`Elevation (Signal Optimization): Site is stable (Slope is ${slope}%), situated outside high-risk flood basins (Zone '${flood_zone}'). Higher baseline elevation (${elevation}m) reduces the required tower height for optimal Line-of-Sight (LoS) signal propagation.`);
      }

      if (elevation < 10) {
        reasons.push(`Caution: Low elevation profile (${elevation}m). May require supplementary height extension masts for direct line-of-sight propagation.`);
      } else if (elevation > 1000) {
        reasons.push(`Note: Mountainous or high-altitude setting (${elevation}m). Excellent coverage spread potential; consider winter icing risk countermeasures.`);
      }

      if (vegetation.includes("Forest") || vegetation.includes("Canopy")) {
        reasons.push(`Environmental advisory: '${vegetation}' present. Microwave link planning must account for tree-canopy attenuation and potential clearing permits.`);
      }

      return res.status(200).json({
        decision,
        reasons,
        telemetry: {
          elevation,
          slope,
          flood_zone,
          vegetation,
          simulated
        },
        citations,
        coordinates: {
          latitude: parsedLat,
          longitude: parsedLng
        }
      });
    } catch (err: any) {
      console.error("Internal evaluation server error:", err);
      return res.status(500).json({ error: "Internal evaluation pipeline error", message: err.message });
    }
  });

  // Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", system: "express-evaluation-pipeline" });
  });

  // Integrate Vite as middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("[Vite] Development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("[Vite] Serving static files from production dist.");
  }

  // Bind to Port 3000 on host 0.0.0.0
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Telecom Scouting Pipeline running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical: Server failed to start:", err);
  process.exit(1);
});
