# 💊 AI-Based Prescription Digitization & Elderly Care Medication Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)

An end-to-end AI-powered web application designed to simplify medication management for elderly patients and caregivers. The system automatically digitizes handwritten or printed doctor prescriptions using Transformer-based AI models, checks for dangerous Drug-Drug Interactions (DDI), extracts structured dosages, and automatically schedules timely medication reminders.

---

## 🌟 Key Features

- 📸 **AI Prescription Scanner (OCR)**: Extracts handwritten and printed medication details from uploaded prescription images using Hugging Face **TrOCR** (`microsoft/trocr-base-handwritten` & `microsoft/trocr-base-printed`).
- 🏷️ **Medical Entity Recognition (NER)**: Automatically parses drug names, strengths, dosages, frequency instructions, and doctor/patient info.
- ⚠️ **Drug Interaction & Safety Analysis**: Checks real-time Drug-Drug Interactions (DDI) and allergy warnings against verified drug databases (RxNorm).
- 📅 **Automated Schedule Generator**: Generates 7-day medication schedules based on prescribed frequencies (e.g., once daily, twice daily, thrice daily).
- 🔔 **Interactive Reminder System**: Caregivers and elderly users can view upcoming doses, mark doses as taken, or snooze reminders with automatic overdue/missed dose tracking.
- 🔒 **Secure Auth & Role Management**: JWT-backed authentication protecting user data and prescription records.

---

## 🏗️ System Architecture

```
                                +---------------------------+
                                |    React / Vite Frontend  |
                                |     (Port 3000 / UI)      |
                                +-------------+-------------+
                                              |
                                       HTTP / REST API
                                              v
                                +-------------+-------------+
                                |  Express / Node Backend   |
                                |       (Port 5000)         |
                                +------+--------------+-----+
                                       |              |
                          Database Ops |              | Forward Prescription
                                       v              v
                              +--------+-----+  +-----+---------------+
                              |   MongoDB    |  |  Python AI Service  |
                              |  (Database)  |  |  (Port 5001 / ML)   |
                              +--------------+  +---------------------+
```

---

## 🛠️ Tech Stack

| Component | Technology / Framework | Description |
|---|---|---|
| **Frontend** | React 18, Vite, React Router | Modern, responsive user interface for prescription management & reminders |
| **Backend API** | Node.js, Express.js, Mongoose | RESTful API server handling authentication, scheduling, & database operations |
| **Database** | MongoDB | Document database for users, prescriptions, medications, and reminder logs |
| **AI / ML Service** | Python, Flask, PyTorch, Hugging Face Transformers | Computer Vision & NLP pipeline for OCR, NER entity parsing, and interaction checking |

---

## 🚀 Quick Start Guide

The application consists of 3 microservices that run concurrently:

### Prerequisites
- **Node.js**: v18 or higher
- **Python**: v3.10 or higher
- **MongoDB**: Installed locally or a free [MongoDB Atlas](https://www.mongodb.com/atlas) connection URI

---

### 1. AI Service (Python / Flask)

```bash
# Navigate to AI service folder
cd ai-service

# Create and activate virtual environment
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the Flask server (runs on http://localhost:5001)
python app.py
```
> **Note**: On first launch, the service will automatically download the TrOCR transformer models (~1.3GB) from Hugging Face.

---

### 2. Backend Server (Node.js / Express)

```bash
# Navigate to backend folder
cd backend

# Create environment configuration file
cp .env.example .env

# Edit .env to set your MongoDB URI and JWT Secret
# MONGODB_URI=mongodb://127.0.0.1:27017/medication-tracker
# JWT_SECRET=your_secure_random_jwt_secret

# Install dependencies
npm install

# Start development server (runs on http://localhost:5000)
npm run dev
```

---

### 3. Frontend Client (React / Vite)

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start Vite dev server (runs on http://localhost:3000)
npm run dev
```

Open **`http://localhost:3000`** in your browser to start using the application!

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `5000` | Port for the backend Express server |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/medication-tracker` | Connection string for MongoDB database |
| `JWT_SECRET` | Required | Secret key used for signing JWT authentication tokens |
| `AI_SERVICE_URL` | `http://127.0.0.1:5001` | URL of the Python AI Flask service |

---

## 📁 Directory Structure

```
AI-Based-Prescription-Digitization-System/
├── ai-service/             # Python ML Service (TrOCR, NER, Interaction Checkers)
│   ├── services/           # OCR, NER, and DDI processing modules
│   ├── training/           # Model fine-tuning scripts and datasets
│   ├── app.py              # Flask server entry point
│   └── requirements.txt    # Python dependencies
├── backend/                # Express REST API Server
│   ├── src/
│   │   ├── models/         # Mongoose schemas (User, Prescription, Medication, Reminder)
│   │   ├── routes/         # Express API endpoints
│   │   ├── middleware/     # Auth and validation middleware
│   │   └── utils/          # Scheduler cron jobs and AI service helpers
│   ├── server.js           # Express app setup & server listener
│   └── package.json
└── frontend/               # React + Vite Web Dashboard
    ├── src/
    │   ├── components/     # UI components (Navbar, ProtectedRoute)
    │   ├── pages/          # Dashboard, Prescriptions, Medications, Reminders, Login/Register
    │   └── services/       # Axios API client setup
    ├── vite.config.js
    └── package.json
```

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
