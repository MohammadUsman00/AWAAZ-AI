<div align="center">
  <img src="./assets/readme-banner.png" alt="Awaaz AI Banner" width="100%" />
  
  # Awaaz AI — آواز
  
  **Voice-first civic complaint platform with multilingual drafting, tracking, user dashboard, and admin operations.**
  
  *ہر شہری کی آواز، اب ایک شکایت بن سکتی ہے · हर नागरिक की आवाज़ अब शिकायत बन सकती है*

  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![Node.js Version](https://img.shields.io/badge/Node.js-18+-success.svg)](https://nodejs.org)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
</div>

---

## 📖 Table of Contents
- [About the Project](#-about-the-project)
- [Platform Overview](#-platform-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Security & Architecture](#-security--architecture)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 About the Project

**Awaaz AI** is an open-source civic-tech platform designed to bridge the gap between citizens and local authorities. By leveraging AI-assisted voice transcription and multilingual translation, it empowers users to report civic issues (such as water supply, road repair, and sanitation) effortlessly in their native language.

The platform automatically structures these reports into formal complaint letters, routes them to the appropriate government departments, and tracks their resolution lifecycle.

---

## 📸 Platform Overview

<table align="center">
  <tr>
    <td align="center" width="50%">
      <b>Admin Control Center</b><br/>
      <sub>Secure portal for issue management and resolution</sub><br/>
      <img src="./docs/screenshots/screenshot-1.png" alt="Admin Dashboard" />
    </td>
    <td align="center" width="50%">
      <b>Live Impact Analytics</b><br/>
      <sub>Public real-time analytics of reported issues</sub><br/>
      <img src="./docs/screenshots/screenshot-2.png" alt="Live Impact Analytics" />
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <b>AI-Powered Submission</b><br/>
      <sub>Multilingual, voice-first complaint generation</sub><br/>
      <img src="./docs/screenshots/screenshot-3.png" alt="Complaint Submission" />
      <br/><img src="./docs/screenshots/screenshot-4.png" alt="Complaint Submission Draft" />
    </td>
    <td align="center" width="50%">
      <b>Citizen Dashboard</b><br/>
      <sub>Anonymous tracking of filed complaints</sub><br/>
      <img src="./docs/screenshots/screenshot-5.png" alt="Citizen Dashboard" />
    </td>
  </tr>
</table>

---

## ✨ Key Features

- 🌍 **Multilingual Support:** Natively supports English (`en`), Urdu (`ur`), Hindi (`hi`), and Kashmiri (`ks`).
- 🎙️ **Voice-First Input:** Uses browser speech recognition and optional uploaded-audio transcription to allow citizens to dictate complaints.
- 🤖 **AI-Assisted Drafting:** Automatically identifies issue type, severity, and department, and generates formal draft letters in English and Urdu.
- 📊 **Anonymous Tracking & Dashboard:** High-entropy tracking IDs and session-based dashboards (`/dashboard`) allow citizens to track complaints without creating accounts.
- 🔐 **Admin Operations:** Token-protected admin panel (`/admin`) for filtering, status updates (`filed`, `under_review`, `resolved`, `rejected`), and deletion.
- 📄 **PDF Export:** Generates formal, downloadable PDF complaint letters.
- 📈 **Real-time Analytics:** Homepage visualization of aggregate complaint data and geographic impact.

---

## 🛠 Tech Stack

- **Runtime:** Node.js (ESM)
- **Backend Framework:** Express.js, Helmet, CORS, express-rate-limit, Zod
- **Database:** SQLite (via `better-sqlite3`)
- **AI Integration:** Google Gemini (`gemini-2.5-flash-lite`) with Groq Whisper fallback
- **Document Generation:** PDFKit
- **Email Service:** Resend (optional, encrypted at rest)
- **Quality Assurance:** Vitest (API/unit), Playwright E2E, Pino logging

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MohammadUsman00/AWAAZ-AI.git
   cd AWAAZ-AI
   ```

2. **Configure Environment Variables:**
   Copy the example file and fill in your keys.
   ```bash
   cp .env.example .env
   ```
   *Required Keys:*
   - `GEMINI_API_KEY`: Required for the AI analysis engine.
   - `ADMIN_TOKEN`: Required to secure the `/admin` route.

3. **Install Dependencies:**
   ```bash
   npm install
   ```
   *(Note: If you change Node versions and hit native module ABI errors, run `npm rebuild better-sqlite3`)*

4. **Run the Application:**
   ```bash
   npm run dev    # Development mode with auto-reload
   # OR
   npm start      # Production mode
   ```

5. **Access the App:** Open `http://localhost:8080` in your browser.

---

## 🛡 Security & Architecture

- **Data Privacy:** Raw optional emails are encrypted at rest using AES-256-GCM.
- **Authentication:** The `/admin` dashboard uses Basic Auth (Username: `admin`, Password: `ADMIN_TOKEN`).
- **Protection:** Helmet + CSP headers, API rate-limiting, and Zod schema validation.
- **Intentional Limitations:** No full RBAC or OTP citizen login. The platform favors anonymity and low barriers to entry.

---

## ☁️ Deployment

This repository is configured for easy deployment on **Render**.

1. Create a **Blueprint Instance** in Render using the included `render.yaml`.
2. Select the `free` tier (Note: Free tier uses an ephemeral disk).
3. Set your environment variables in the Render dashboard (`GEMINI_API_KEY`, `ADMIN_TOKEN`, `EMAIL_SECRET`, `PUBLIC_BASE_URL`).
4. Deploy!

*For persistent data in production, upgrade to a paid Render plan, attach a persistent disk to `/data`, and update `DB_PATH=/data/awaaz.db`.*

---

## 🤝 Contributing

We welcome contributions from the community! To get started:

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Ensure tests pass (`npm run test:all`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
