<div align="center">

# NexRay

<p><b>AI-Powered Medical Image Analysis Platform</b></p>

<p>
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
</p>

<p>A full-stack medical imaging platform that combines <b>real-time AI analysis</b> with a professional <b>dark DICOM-viewer interface</b>. Upload X-rays and medical images, run specialized diagnostic tools, and receive structured radiological reports streamed in real time.</p>

</div>

---

<h2>Features</h2>

<p><b>6 Specialized Analysis Tools</b> — each powered by a fine-tuned radiological prompt:</p>

| Tool | Focus Area |
|------|-----------|
| **Full Analysis** | Comprehensive radiological report covering all findings |
| **Bone Analysis** | Osseous structures, fractures, mineralization, alignment |
| **Soft Tissue** | Swelling, masses, calcifications, fat planes |
| **Pathology Hunt** | Active pathology detection — nodules, infiltrates, effusions |
| **Cardiopulmonary** | Heart size, pulmonary vascularity, mediastinal assessment |
| **Reference Guide** | Normal vs. abnormal comparison framework |

<p><b>Real-Time SSE Streaming</b> — analysis results stream token-by-token into a structured report with 7 standardized sections: Technical Quality, Systematic Findings, Abnormal Findings, Clinical Impression, Differential Diagnoses, Recommendations, and Urgency Level.</p>

<p><b>Interactive Image Controls</b> — brightness (0–300%), contrast (0–500%), zoom (25–400%), and invert/negative toggle for detailed examination.</p>

<p><b>Auto & Manual Annotations</b> — AI-detected pathology regions are highlighted with color-coded bounding boxes. Draw your own annotations with custom labels for anatomy (cyan), pathology (red), and devices (orange).</p>

<p><b>Professional DICOM-Viewer UI</b> — dark theme interface with live API status indicator, system workstation ID, real-time clock, animated scan bar during analysis, and responsive layout.</p>

---

<h2>Tech Stack</h2>

| Layer | Technologies |
|-------|-------------|
| **Backend** | Python 3.10+, Flask 3, Flask-CORS, Pillow, python-dotenv |
| **AI / ML** | Ollama (NexRay 4B), Google Gemini 2.0 Flash, Transformers, PyTorch |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Streaming** | Server-Sent Events (SSE) |

---

<h2>Prerequisites</h2>

<p>Before you begin, make sure you have the following installed:</p>

- **Python** 3.10 or newer
- **Node.js** 18 or newer
- **Ollama** with the `amsaravi/nexray-4b-it:q6` model pulled, **or** a **Google Gemini API key** ([free tier available](https://aistudio.google.com))

---

<h2>Getting Started</h2>

<h3>1. Clone the repository</h3>

```bash
git clone https://github.com/idevanshu/Medgemma.git
cd Medgemma
```

<h3>2. Backend setup</h3>

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and add your API keys (GEMINI_API_KEY, HF_TOKEN, etc.)

# Start the Flask server
python app.py
# Runs on http://localhost:5000
```

<h3>3. Frontend setup</h3>

<p>Open a <b>second terminal</b>:</p>

```bash
cd frontend

npm install
npm run dev
# Runs on http://localhost:3000
```

<h3>4. Open the app</h3>

<p>Navigate to <b>http://localhost:3000</b> in your browser. The frontend proxies all <code>/api/*</code> requests to the Flask backend automatically.</p>

---

<h2>Usage</h2>

<p><b>Step 1 — Upload:</b> Drag and drop or click to browse for a medical image (PNG, JPG, JPEG, BMP, TIFF, WEBP).</p>

<p><b>Step 2 — Select a Tool:</b> Pick one of the 6 analysis modes from the left sidebar.</p>

<p><b>Step 3 — Adjust Image:</b> Use brightness, contrast, zoom, and invert controls to examine the image.</p>

<p><b>Step 4 — Run Analysis:</b> Click <b>"Run [Tool]"</b> in the top toolbar to start the AI analysis.</p>

<p><b>Step 5 — Review Report:</b> Watch the structured radiological report stream in real time in the right panel.</p>

---

<h2>API Endpoints</h2>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check and API key status |
| `POST` | `/api/upload` | Upload image, returns base64 and metadata |
| `POST` | `/api/analyze` | Full comprehensive SSE streaming analysis |
| `POST` | `/api/analyze/tool` | Focused tool-specific SSE streaming analysis |
| `POST` | `/api/analyze/annotate` | Auto-detect pathology regions as JSON boxes |

---

<h2>Project Structure</h2>

```
Medgemma/
├── backend/
│   ├── app.py                # Flask API, system prompts, SSE streaming
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Environment variable template
│   └── test_hf.py            # HuggingFace model test script
├── frontend/
│   ├── src/
│   │   ├── App.tsx                       # Root component & state orchestration
│   │   ├── main.tsx                      # React entry point
│   │   ├── index.css                     # Dark DICOM-viewer theme & animations
│   │   ├── components/
│   │   │   ├── Header.tsx                # Top bar — API status, clock, filename
│   │   │   ├── ToolBar.tsx               # Left sidebar — tools & image filters
│   │   │   ├── XRayViewer.tsx            # Center — image canvas & annotations
│   │   │   ├── ImageUploader.tsx         # Drag-and-drop upload zone
│   │   │   ├── AnalysisPanel.tsx         # Right panel — streaming AI report
│   │   │   ├── ReportPanel.tsx           # Structured section parser
│   │   │   └── LabelDialog.tsx           # Annotation labeling modal
│   │   ├── hooks/
│   │   │   ├── useAnalysis.ts            # SSE streaming hook
│   │   │   ├── useAnnotations.ts         # Auto-detected pathology boxes
│   │   │   └── useManualAnnotations.ts   # User-drawn annotations
│   │   └── types/
│   │       └── index.ts                  # TypeScript interfaces
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
└── README.md
```

---

<h2>Environment Variables</h2>

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (optional if using Ollama) |
| `HF_TOKEN` | HuggingFace token for model access |
| `OLLAMA_BASE_URL` | Ollama server URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Model to use (default: `amsaravi/nexray-4b-it:q6`) |

---

<h2>Contributing</h2>

<p>Contributions are welcome! Feel free to open an issue or submit a pull request.</p>

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---


<div align="center">
  <p>Built by <a href="https://github.com/idevanshu"><b>@idevanshu</b></a></p>
</div>
