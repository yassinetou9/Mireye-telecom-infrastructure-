# Miereye Telecom Infrastructure Scouting Pipeline

## Overview

The **Miereye Telecom Infrastructure Scouting Pipeline** is an automated, real-time geographic evaluation engine. By ingesting geographic coordinates (Latitude/Longitude), the system instantly queries, aggregates, and processes high-fidelity environmental telemetry to provide deterministic, rules-based decisions (**APPROVED**, **WARNING**, or **REJECTED**) for telecom infrastructure deployment.

## Features

* **Real-time Telemetry Streaming**: Evaluates sites based on elevation, terrain slope, flood zones, and vegetation density.
* **Deterministic Rules Engine**: Automatically rejects sites in high-risk FEMA inundation zones and warns against steep inclines.
* **Fallback Simulation Engine**: Works offline or without credentials by mathematically simulating high-fidelity telemetry based on coordinate cryptographic seeding.
* **Mireye API Integration**: Securely proxies requests to the upstream Mireye v1 API using user-provided authentication tokens.

## Tech Stack

* **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
* **Backend**: Node.js, Express, TypeScript (esbuild bundled)
* **Styling**: Tailwind CSS Typography & custom animations

## Getting Started

### Prerequisites

* Node.js (v18+)
* npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup Environment Variables:
   Copy the example environment file and configure any necessary secrets (if applicable):
   ```bash
   cp .env.example .env
   ```

### Running the Application

Start the development server (runs both the Vite frontend and Express backend proxy):

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Production Build

To bundle the application for production deployment:

```bash
npm run build
npm run start
```

## Authentication

To use real-world telemetry rather than the local simulation engine, you must provide a Mireye API Token.

1. Sign in at [www.mireye.com](https://www.mireye.com) (Google or email/password with a verified address).
2. Create an API token in your account settings.
3. Paste the token into the "Mireye Authentication" field on the app's main dashboard.

Prefer to work through an agent? The hosted MCP server is at `https://api.mireye.com/mcp`, or you can run it locally with `uvx mireye-mcp`.

## Documentation

For an extensive technical deep-dive, including ruleset definitions, architecture breakdown, and exhaustive case studies, please refer to the [DOCUMENTATION.md](./DOCUMENTATION.md) file.
