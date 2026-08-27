# AI-Based Web Application for Prescription Digitization and Medication Reminders in Elderly Care

Three services, run separately:

| Service      | Tech                          | Port |
|--------------|--------------------------------|------|
| `ai-service` | Python / Flask (OCR, NER, DDI) | 5001 |
| `backend`    | Node / Express / MongoDB       | 5000 |
| `frontend`   | React / Vite                   | 3000 |

## 1. AI service

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
python app.py
```

First run downloads the TrOCR model (~1.3GB) from Hugging Face — this can take a
few minutes and needs internet access. It listens on `http://localhost:5001`.

## 2. Backend

Requires a running MongoDB instance (local `mongod`, or a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
cd backend
cp .env.example .env    # then edit MONGODB_URI / JWT_SECRET if needed
npm install
npm run dev              # nodemon, or `npm start` for plain node
```

Check it's healthy: `curl http://localhost:5000/health` should return
`{"status":"healthy","mongoConnected":true,...}`.

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`, register an account, then:

1. Go to **Prescriptions** → upload a photo of a prescription. The backend
   forwards it to the AI service for OCR + drug-name/dosage extraction +
   interaction checking.
2. Review the extracted medications, then **Confirm** to turn them into
   tracked `Medication` records and generate the next 7 days of reminders.
3. **Dashboard** shows the next dose due; **Reminders** lets you mark doses
   taken or snooze them; **Medications** lists everything you're tracking
   and lets you add medications manually.

## What was fixed vs. the original skeleton

The original zip did not run end-to-end:
- `backend/sever.js` was misnamed (should be `server.js`) so `npm start` failed immediately.
- All backend route files (`medications.js`, `prescription.js`, `reminders.js`) and
  all Mongoose models (`User.js`, `Medication.js`, `Prescription.js`, `Reminder.js`)
  were empty (0 bytes).
- `server.js` imported route files/paths that didn't exist (`./src/routes/auth`,
  `./src/routes/prescriptions`, `./src/routes/users`, vs. the actual
  `./src/models/routes/...` files).
- The frontend `App.jsx` imported six files that were never created:
  `hooks/useAuth`, `pages/Dashboard`, `pages/Medications`, `pages/Reminders`,
  `pages/Login`, `pages/Register`, `components/ProtectedRoute`, plus the
  stylesheets.
- `database/init.sql` was empty and unused (the app uses MongoDB, not SQL).
- `README.md` was actually an empty directory, not a file.

All of the above now exist with working implementations: JWT auth, prescription
upload → AI processing → confirm-into-medications → auto-generated reminders,
a reminder dashboard with mark-taken/snooze, and a cron job that marks
overdue reminders as missed. The AI service itself (TrOCR OCR, regex-based
NER, rule-based + RxNorm drug-interaction checking) was already implemented
in the original zip and is unchanged.

## Round 2 fixes (from code review)

A follow-up review caught real bugs in the first pass that were fixed here:
- **Hard-coded JWT fallback secret** — `auth.js`/`middleware/auth.js` used
  to fall back to `'dev-secret-change-me'` if `JWT_SECRET` was unset, which
  would let anyone with this repo mint valid tokens against a misconfigured
  deployment. It's now a shared `src/config.js` that throws at startup if
  `JWT_SECRET` is missing, so the app fails loudly instead of silently.
- **Snoozed reminders could disappear forever** — `/snooze` only set
  `snoozeUntil` while `/upcoming` and the missed-reminder cron job kept
  filtering on the original `scheduledTime`. Once that original time passed,
  the reminder fell out of both queries and never became due or missed
  again. Snoozing now updates `scheduledTime` itself, and the cron job
  checks `snoozed` reminders too.
- **Prescriptions page never reloaded saved data and misread API responses**
  — `uploadPrescription()`/`confirmPrescription()` return the full Axios
  response, but the page was treating that response as the prescription
  object itself (`prescription._id` was actually `undefined`). It also
  never called `getPrescriptions()`, so uploads vanished on refresh. Fixed
  both, and re-render from the server's response after confirming/saving times.
- **Editing a medication's times directly (not via a prescription) silently
  killed future reminders** — the route deleted pending reminders but never
  regenerated them. Reminder generation is now a shared
  `utils/reminderScheduler.js` used by both flows.
- **Midnight doses (00:00, four-times-daily) silently rescheduled to 8am**
  — `hours || 8` treats `0` as falsy. Fixed with an explicit `NaN` check.

## Known gaps vs. the project report

The report also describes machine-learning-based DDI detection (the current
DDI service is rule-based + RxNorm API, not a trained ML classifier),
voice-prompt and push/SMS notifications (Twilio env vars are wired in but
not yet called anywhere), and formal OCR/NER accuracy evaluation and
user-acceptability testing (not yet run). Worth flagging to your guide if
the report claims these as already complete.
