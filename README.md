🚨 CRISIS COMMAND
Multi-Agent Emergency Response & Resource Coordination Agent
GATEWAYS 2026 · Domain 4: Public Safety & Emergency Response
Intelligent crisis coordination powered by multi-agent reasoning, mathematical optimization, dynamic replanning, and human-in-the-loop control.

🎯 Overview
Crisis Command is a multi-agent emergency response and resource coordination platform designed for rapidly evolving crisis situations. The system receives emergency incidents through structured inputs or free-text reports, assesses their severity and resource requirements, allocates limited emergency resources using mathematical optimization, continuously replans when conditions change, explains why plans changed, and escalates unresolved resource shortages to a human decision-maker.
Core principle: AI understands the crisis. Mathematics allocates the resources. Humans retain control over exceptional decisions.
🚨 Problem
Emergency control rooms frequently face situations where multiple incidents occur simultaneously while critical resources remain limited.
🚑 Ambulances
🚒 Fire teams
🛟 Rescue teams
🏥 Medical units
🏠 Emergency shelters
A critical incident suddenly arrives.
Multiple incidents compete for the same resource.
An assigned unit becomes unavailable or returns.
A resource category becomes completely exhausted.
Waiting incidents require increasing priority.
The existing plan must be changed without losing operational history.
A static allocation system cannot adequately handle these constantly changing conditions.
💡 Solution
Crisis Command introduces a neuro-symbolic emergency coordination architecture. The system separates language understanding from resource allocation.
AI / NLP Layer
Free-text report
       ↓
Incident Assessment
       ↓
Type
Severity
Urgency
Location
Required Resource Types
Confidence
Optimization Layer
Assessed Incident
       +
Available Resources
       +
Priorities
       +
ETA
       +
Constraints
       ↓
PuLP + CBC
       ↓
Optimal Resource Allocation
The LLM never directly assigns resources. This separation makes the system more deterministic, auditable, and explainable.
🧠 Core Principles
🏗️ Architecture
React Dashboard
      │
      ├── REST ───────────────► FastAPI
      │                           │
      └── WebSocket /ws ────────►│
                                  ▼
                    Command & Planning Agent
                         │          │
                         ▼          ▼
               Incident Assessment  Resource Allocation
                         │          │
                         │          ▼
                         │      PuLP + CBC
                         │
                         ├── Route / ETA Service
                         └── Equity Priority Service
                                  │
                                  ▼
                               MongoDB
                                  │
                         Audit / Event Log
                                  │
                         WebSocket Broadcaster
🤖 Multi-Agent System
1. Incident Assessment Agent
agents/incident_assessment_agent.py
Converts emergency text into structured incident information.
Incident type
Severity
Urgency
Location
Required resource types
Confidence
The agent can use an LLM when LLM_API_KEY is configured. If no LLM is available, the system falls back to configurable keyword-based rules in data/assessment_rules.py.
2. Resource Allocation Agent
agents/resource_allocation_agent.py
The Resource Allocation Agent contains no LLM-based resource assignment.
Receives assessed incidents.
Evaluates available resources.
Builds the optimization model.
Executes PuLP + CBC.
Generates assignments.
Produces data-backed allocation reasons.
3. Command & Planning Agent
agents/command_planning_agent.py
Acts as the operational coordinator.
Owns global state.
Handles events.
Triggers reoptimization.
Compares previous and new plans.
Generates explanations.
Raises human approvals.
Writes audit events.
Broadcasts updates through WebSocket.
📐 Optimization Engine
optimization/resource_optimizer.py
The optimization engine models resource assignment as a Mixed Integer Linear Programming (MILP) problem.
Resource Slot
A slot represents one required resource type for one incident.
Incident: Building Fire

Required:
- Fire Team
- Ambulance
Decision Variables
x[slot, resource] ∈ {0,1}
y[incident] ∈ {0,1}
x determines whether a resource is assigned to a particular requirement. y determines whether an incident is fully covered.
🔒 Hard Constraints
Availability — unavailable or maintenance units are never candidates.
Type Matching — resource type and required capability must match.
Slot Assignment — a resource can satisfy at most one required slot.
Incident Assignment — a resource cannot be assigned to multiple incidents simultaneously.
No Fake Resources — the system never creates artificial resources to hide shortages.
🎯 Optimization Objective
Σ x ·
(
    effective_priority
    + urgency × weight
    + base score
    - ETA × weight
    + stability
)
+
completion_bonus × priority × y
This allows the system to balance incident priority, urgency, response ETA, resource stability, and full incident coverage.
🚗 Route & ETA Calculation
No paid mapping API is required. Distance is calculated using the Haversine formula.
Latitude + Longitude
        ↓
Haversine Distance
        ↓
Road Factor
        ↓
Estimated Distance
        ↓
Average Speed
        ↓
ETA
services/route_service.py
🔄 Dynamic Replanning
Crisis conditions can change at any moment. The system automatically recomputes the response plan when:
A new incident arrives.
A resource becomes unavailable.
A resource returns.
A critical incident changes priorities.
Resource competition changes.
A shortage disappears.
A shortage becomes unresolved.
Event
  ↓
Command Agent
  ↓
Assessment (new incidents)
  ↓
State + Audit Update
  ↓
Resource Allocation
  ↓
MILP / CBC Solver
  ↓
New Assignments
  ↓
Plan Diff + Explanation
  ↓
Human Approval Check
  ↓
WebSocket State Snapshot
🔍 Explainable Replanning
Every major plan change can be explained.
Previous Plan
      ↓
Triggering Event
      ↓
New Plan
      ↓
Reason for Change
Example:
Why did the plan change?

Previous:
A01 → Road Accident

Event:
Critical building collapse reported.
A01 became unavailable.

New:
A02 → Building Collapse
A03 → Road Accident

Reason:
Criticality increased and A01 became unavailable.
The optimizer recomputed the allocation under the new constraints.
👤 Human-in-the-Loop
Automation does not attempt to hide impossible allocations.
HUMAN_APPROVAL_REQUIRED
If a required resource cannot be covered, the system creates a human approval request.
BOUNDARY_COLLAPSE
If a resource type has zero eligible units anywhere, the system additionally records BOUNDARY_COLLAPSE. No fake resources are created.
Approval API
POST /api/approval/approve
POST /api/approval/reject
If an approval has already been decided, 409 Conflict is returned. Every decision becomes part of the audit history.
⚖️ Equity-Aware Prioritization
effective_priority
=
severity_weight
+
min(
    max_waiting_bonus,
    waiting_coefficient × minutes_waiting
)
Default Severity Weights
Waiting Configuration
Waiting coefficient: 0.5 points/minute
Maximum waiting bonus: +30
These values are configurable through backend/config.py. Waiting begins accruing while an incident does not have full coverage. The demo provides Advance +10 min to demonstrate the effect.
💾 Database Architecture
Crisis Command uses MongoDB for persistent state.
MongoDB
   │
   ├── incidents
   ├── resources
   ├── approvals
   ├── plans
   ├── plan_history
   ├── events
   └── meta
The agents operate on in-memory state while the command agent serializes mutations. Changes are persisted after every operation.
A restart restores incidents, resources, current plan, plan history, approvals, audit events, ID counters, simulated clock, and acknowledged shortages.
🗃️ MongoDB Collections
🛡️ Persistence & Failure Handling
Startup
The application connects to MongoDB and performs a ping. If MongoDB is unreachable, the application fails fast. This prevents the application from starting with empty state and accidentally overwriting real data.
Runtime Database Outage
Operations
    ↓
Continue in memory
    ↓
Failure logged
    ↓
GET /api/health
    ↓
database.status = "degraded
When the database becomes available again, the next successful write catches up the persisted state.
❤️ Health Endpoint
GET /api/health
{
  "database": {
    "backend": "mongodb",
    "database": "crisis_command",
    "status": "ok"
  }
}
🧰 Technology Stack
🚀 Installation
Requirements
Python 3.10+
Node.js 18+
MongoDB 5+
Git
MongoDB can run locally or through MongoDB Atlas.
1. Clone the Repository
git clone https://github.com/balajigs08/CHRIST_HACKATHON.git
cd CHRIST_HACKATHON
2. Configure Environment
cp .env.example backend/.env
MONGODB_URI=mongodb://localhost:27017
Alternatively, provide your MongoDB Atlas connection string.
3. Optional — Start MongoDB with Docker
docker compose up -d mongo
MongoDB data is stored in a named Docker volume.
🐍 Backend Setup
cd backend
Windows
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
API documentation: http://localhost:8000/docs
⚛️ Frontend Setup
cd frontend
npm install
npm run dev
Frontend: http://localhost:5173
The Vite development server proxies /api → :8000 and /ws → :8000.
🧪 Testing
cd backend
pytest -v
The tests do not require a running MongoDB server. They use a strict in-memory MongoDB implementation: tests/fake_mongo.py.
Test Coverage
tests/test_agents.py — assessment, allocation, conflicts, prioritization, waiting-time equity, optimization failure, dynamic replanning, zero-resource situations, approvals, explanations.
tests/test_api.py — REST APIs and WebSocket communication.
tests/test_persistence.py — restart/restore, ID continuity, reset, database outage, fail-fast startup.
🎬 Demo Scenario
1️⃣ Load T = 0
🚗 Road Accident     → High
🔥 Building Fire     → Critical
🏥 Medical Incident  → Medium
CBC calculates the initial allocation. Example resources include A01, A02, A03 and F01. Exact assignments are determined by the optimizer.
2️⃣ Advance to T + 10
🏢 Building Collapse
A01 → unavailable
Updates the state.
Recalculates priorities.
Rebuilds the optimization model.
Runs CBC.
Generates a new allocation.
Compares old and new plans.
Explains why the plan changed.
Updates the timeline.
Raises human approval if resources are insufficient.
3️⃣ Human Approval
If the number of required ambulances exceeds available ambulances, HUMAN_APPROVAL_REQUIRED appears in the dashboard.
APPROVE    /    REJECT
The decision is recorded in the audit log.
4️⃣ Restore Ambulance
A01 → available
The optimizer runs again. The shortage may shrink or disappear. The previous unresolved approval is superseded when the shortage condition changes.
🖥️ Interactive Incident Assessment
The dashboard supports free-text emergency reports.
There is a major fire in a commercial building
near the city center. Several people may be trapped.
Type:
Building Fire

Severity:
Critical

Urgency:
High

Required Resources:
Fire Team
Ambulance

Location:
Extracted / assessed location

Confidence:
Validated output
The allocation layer then handles the resource assignment.
🌐 REST & WebSocket API
Core Endpoints
GET  /api/health

GET  /api/incidents
POST /api/incidents

GET  /api/resources
POST /api/resources

GET  /api/plan

GET  /api/events

GET  /api/approvals

GET  /api/state

GET  /api/plan/history
Approval
POST /api/approval/approve
POST /api/approval/reject
Simulation
POST /api/simulation/incident
POST /api/simulation/break-ambulance
POST /api/simulation/restore-ambulance
POST /api/simulation/advance
POST /api/simulation/demo-t0
POST /api/simulation/demo-t10
POST /api/simulation/reset
⚡ WebSocket
/ws/dashboard
The WebSocket broadcasts events such as:
incident_created
resource_unavailable
resource_reallocated
plan_recalculated
human_approval_required
boundary_collapse
Each event is followed by a state_snapshot so the dashboard remains synchronized with backend state in real time.
📦 API Error Format
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable explanation"
  }
}
📁 Project Structure
CHRIST_HACKATHON/
│
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   └── routes.py
│   ├── agents/
│   │   ├── incident_assessment_agent.py
│   │   ├── resource_allocation_agent.py
│   │   ├── command_planning_agent.py
│   │   └── llm_client.py
│   ├── optimization/
│   │   └── resource_optimizer.py
│   ├── services/
│   │   ├── state_store.py
│   │   ├── route_service.py
│   │   ├── priority_service.py
│   │   ├── plan_diff.py
│   │   ├── simulation_service.py
│   │   ├── clock.py
│   │   └── container.py
│   ├── events/
│   │   ├── event_log.py
│   │   └── ws_manager.py
│   ├── models/
│   │   ├── schemas.py
│   │   └── errors.py
│   ├── db/
│   │   └── mongo.py
│   ├── data/
│   ├── utils/
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
⚠️ Known Limitations
Single backend process.
State is loaded from MongoDB into memory; run exactly one backend instance.
No real routing provider; ETA uses Haversine distance, road factor and simulated average speed.
LLM path requires an API key and is optional; rule-based fallback is available.
Single-process WebSocket fan-out.
Resources are currently treated as whole units; partial resource capacity is not modeled.
🛣️ Future Roadmap
Phase 1 — Intelligent Assessment
✅ Free-text incident assessment
✅ Rule-based fallback
✅ Structured incident extraction
✅ Confidence validation
Phase 2 — Optimization
✅ MILP resource allocation
✅ CBC solver
✅ Hard resource constraints
✅ ETA-aware optimization
✅ Stability-aware planning
Phase 3 — Dynamic Crisis Management
✅ Live replanning
✅ Resource failure handling
✅ Resource restoration
✅ Plan diff
✅ Audit events
Phase 4 — Human Oversight
✅ Human approval requests
✅ Approval / rejection workflow
✅ Boundary collapse detection
✅ Shortage supersession
Future Enhancements
Real emergency GIS integration
Live traffic-aware ETA
Predictive incident escalation
Multi-city crisis coordination
Advanced resource capacity modeling
Role-based access control
Production authentication
Cloud-native deployment
Distributed event processing
Advanced crisis analytics
🔐 Security Considerations
Role-Based Access Control
Secure authentication
API authorization
Encrypted communication
Secrets management
Input validation
Rate limiting
Secure WebSocket connections
Audit trail protection
Database access controls
🧩 Why Neuro-Symbolic?
Crisis response requires both understanding and constraint-based reasoning. Pure LLM systems can interpret natural language effectively but should not independently decide how scarce emergency resources are allocated.
                 CRISIS REPORT
                       │
                       ▼
              ┌─────────────────┐
              │   AI / NLP      │
              │ Understanding   │
              └────────┬────────┘
                       │
                       ▼
              Structured Incident
                       │
                       ▼
              ┌─────────────────┐
              │  Optimization   │
              │  PuLP + CBC      │
              └────────┬────────┘
                       │
                       ▼
              Resource Allocation
                       │
                       ▼
              ┌─────────────────┐
              │     HUMAN       │
              │   OVERSIGHT     │
              └─────────────────┘
This architecture combines probabilistic understanding with deterministic decision constraints and human accountability.
📊 System Philosophy
Understand with AI.
Optimize with mathematics.
Explain every change.
Keep humans in control.
🏆 GATEWAYS 2026
👥 Team
📜 License
This project is developed as part of GATEWAYS 2026.
Licensed under the MIT License.
🚨 CRISIS COMMAND

From emergency signals to coordinated action.

AI-Assisted · Optimization-Driven · Human-Controlled
Principle | Implementation
🧠 Intelligent Understanding | Multi-agent incident assessment
📐 Deterministic Allocation | PuLP + CBC optimization
🔄 Dynamic Replanning | Re-optimization after state changes
👤 Human Control | Approval workflow for shortages
⚖️ Equity | Waiting-time priority mechanism
🔍 Explainability | Plan-diff and audit explanations
💾 Persistence | MongoDB state recovery
⚡ Real-Time Operations | WebSocket event broadcasting

Severity | Weight
Critical | 100
High | 80
Medium | 50
Low | 20

Collection | _id | Content
incidents | INC001 | Incident documents
resources | A01 | Resource documents
approvals | APR001 | Human approval requests
plans | PLN003 | Current / full plans
plan_history | PLN003 | Historical plans
events | EVT0042 | Append-only audit log
meta | state | Counters, clock, state metadata

Layer | Technology
Frontend | React 18, Vite, Tailwind CSS 3, Axios, WebSocket
Backend | Python 3.10+, FastAPI, Pydantic v2, asyncio
AI / Agents | Multi-Agent Architecture, Optional LLM, Rule-based fallback
Optimization | PuLP, COIN-OR CBC, MILP
Database | MongoDB 5+, PyMongo
Data Processing | Pandas
Infrastructure | Docker, Docker Compose, WebSocket

Attribute | Details
Domain | Domain 4 — Public Safety & Emergency Response
Project | Crisis Command
Focus | Multi-Agent Emergency Response & Resource Coordination
Architecture | Neuro-Symbolic Multi-Agent System
Optimization | PuLP + COIN-OR CBC
Backend | FastAPI
Frontend | React + Vite + Tailwind
Database | MongoDB
Communication | REST + WebSocket

Member | Role
[Member Name] | [Role]
[Member Name] | [Role]
[Member Name] | [Role]
[Member Name] | [Role]
