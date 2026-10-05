# ShaderFlow

**Voice-native generative graphics system that turns natural-language creative intent into a typed shader graph, deterministic GLSL, and real-time WebGL visuals.**

## What is ShaderFlow?

ShaderFlow is a professional generative graphics environment built for real-time visual exploration. Instead of manually dragging nodes or writing code, developers and artists can simply *speak* or *describe* their creative intent. ShaderFlow maps these natural-language requests into a deterministic, strictly-typed node graph, which compiling down into optimized GLSL to run directly on the GPU.

## Why it exists

Traditional node-based shader editors are powerful but technically demanding and slow to manipulate. AI code generators often produce black-box or hallucinated outputs that are difficult to iterate on. ShaderFlow bridges this gap by acting as a **creative copilot**: it understands visual concepts ("make it more fluid", "make a flowing blue cloud") and maps them to concrete, auditable graph mutations that the artist retains full control over.

## The Architecture

ShaderFlow is built on a strict, transactional data pipeline. 

```text
Wispr Flow (Speech-to-Text)
       ↓
Natural Language
       ↓
Intent Planner (Semantic Mapper & Recipes)
       ↓
Typed Shader Graph (Authoritative State)
       ↓
Validation (Type & Topology Checking)
       ↓
Deterministic GLSL Compiler
       ↓
WebGL / GPU
       ↓
Generative Visual Output
```

### Wispr Flow Integration
ShaderFlow is designed to be the receiver of transcription output from **Wispr Flow**. The user dictates their creative requests using Wispr Flow (which handles audio capture and transcription), and ShaderFlow processes the resulting natural-language text. *Note: ShaderFlow itself does not capture microphone audio; it relies on Wispr Flow's dictation.*

### Intent & Semantic Mapping
The `IntentPlanner` heuristically parses language into atomic `IntentMutation` objects. This allows semantic requests (e.g., "Make it more detailed") to securely manipulate exact node parameters (e.g., `noise_1.scale += 2.0`).

### Validation & Last-Known-Good Fallback
All graph mutations are transactional. If a command attempts to connect incompatible ports (e.g., wiring a `vec3` into a `float`), the GLSL compiler and Validator reject the commit. The UI falls back to `LAST KNOWN GOOD`, ensuring the active shader is preserved and the visual output never crashes.

## Example Voice Interactions

- *"Make a flowing blue-purple energy field."* (Generates an entire macro graph)
- *"Make it more detailed."*
- *"Make it move slower."*
- *"Make the colors warmer."*
- *"Add a sine wave."*
- *"Combine noise and sine."*

## How to Run Locally

### Prerequisites
- Node.js (v18+)
- npm

### Development Server
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173/` in your browser.

### Testing
Run the Vitest test suite to verify graph topology, intent parsing, and compiler output:
```bash
npx vitest run
```

### Type Checking
Ensure type safety across the graph and mutation models:
```bash
npx tsc --noEmit
```

### Building for Production
```bash
npm run build
```
