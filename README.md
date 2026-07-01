# SecureVault – Secure Login System

A full-stack secure authentication system with JWT, CSRF protection, password reset, 2FA, audit logs, and a React dashboard.

A **production-ready**, full-stack authentication web application featuring enterprise-grade security, a cybersecurity-themed UI, and comprehensive features including 2FA, session management, audit logs, and more.

---

## 🔐 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | MySQL + mysql2 |
| Authentication | JWT + Express Sessions |
| Password Hashing | bcrypt (12 rounds) |
| 2FA | TOTP via Speakeasy + QR Code |
| Validation | express-validator |
| Security | Helmet, CORS, CSRF, Rate Limiting |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+

### 1. Clone and Setup

```bash
# Clone / open the project
cd "Secure Login System"
```

### 2. Database Setup

Open MySQL and run the schema:

```bash
mysql -u root -p < server/database/schema.sql
```

Or manually in MySQL Workbench / CLI:
```sql
CREATE DATABASE IF NOT EXISTS secure_login;
USE secure_login;
-- Then paste the contents of server/database/schema.sql
```

### 3. Backend Setup

```bash
cd server
npm install
# .env is already pre-configured with default values
# Edit server/.env if your MySQL credentials differ
npm run dev
```

Backend starts at: `http://localhost:5000`

### 4. Frontend Setup

```bash
cd client
npm install
npm run dev
```

Frontend starts at: `http://localhost:5173`

---

## 📁 Folder Structure

```
Secure Login System/
├── server/
│   ├── config/          # Database & session config
│   ├── controllers/     # Route handlers
│   ├── database/        # SQL schema
│   ├── middleware/       # Auth, validation, rate limiting
│   ├── models/          # Database models (parameterized queries)
│   ├── routes/          # Express routes
│   ├── utils/           # JWT, email, audit logger helpers
│   ├── app.js           # Express app entry point
│   └── .env             # Environment variables
│
├── client/
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── pages/       # Page components
│   │   ├── services/    # API service layer
│   │   ├── store/       # Zustand auth store
│   │   └── utils/       # Validators, formatters
│   ├── index.html
│   └── vite.config.js   # Proxies /api → localhost:5000
│
├── .env.example          # Sample env file
└── README.md
```

---

## 🔗 API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Login (returns JWT) |
| POST | `/api/auth/logout` | Destroy session |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset with token |

### Profile (Protected)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/profile` | Get current user |
| PUT | `/api/profile` | Update name/username |
| PUT | `/api/profile/change-password` | Change password |

### Two-Factor Auth (Protected)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/2fa/enable` | Generate QR code |
| POST | `/api/2fa/verify` | Activate 2FA |
| POST | `/api/2fa/disable` | Disable 2FA |
| POST | `/api/2fa/login-verify` | Verify OTP at login |

### Session (Protected)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/session` | Session info |
| GET | `/api/session/history` | Login history |
| GET | `/api/session/audit` | Audit logs |

---

## 🛡️ Security Features

| Feature | Implementation |
|---|---|
| **Password Hashing** | bcrypt, salt rounds = 12 |
| **SQL Injection** | Parameterized queries (mysql2) |
| **XSS Protection** | Helmet CSP + input sanitization |
| **CSRF Protection** | Custom CSRF token in session + X-CSRF-Token header |
| **Rate Limiting** | 5 login attempts / 15 min lock |
| **Account Lockout** | Auto-lock after 5 failed logins (15 min) |
| **Secure Cookies** | HttpOnly, Secure, SameSite=Strict |
| **JWT** | HS256, 1-hour expiry |
| **Session Security** | Regenerate session ID on login |
| **2FA** | TOTP (RFC 6238) via Speakeasy |
| **Audit Logs** | Every action logged to DB |

---

## 🎨 UI Pages

- **/** – Landing page with feature overview
- **/register** – Registration with real-time password strength meter
- **/login** – Login with 2FA support
- **/dashboard** – Security overview, login history, audit logs
- **/profile** – Edit profile information
- **/change-password** – Change password (invalidates session)
- **/security** – Enable/disable 2FA, security summary
- **/forgot-password** – Request reset link
- **/reset-password** – Set new password via token
- **/404** – Not found page

---

## 🧪 Test Credentials

After running the schema, register a test user via the UI or API:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test@123456",
    "confirm_password": "Test@123456"
  }'
```

Password requirements:
- Minimum 8 characters
- One uppercase letter
- One lowercase letter
- One number
- One special character

---

## 📧 Forgot Password (Dev Mode)

Since SMTP is optional, in development mode the reset token is:
1. Printed to the server console
2. Returned in the API response as `devToken` and `devResetUrl`
3. Shown in the UI as a clickable link

Configure `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` in `server/.env` to enable real email sending.

---

## ⚙️ Environment Variables

See `.env.example` for all available variables. The critical ones are:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=secure_login
DB_USER=root
DB_PASSWORD=your_password

JWT_SECRET=your_64_char_random_string
SESSION_SECRET=your_session_secret
```

---

## 📄 License

MIT – Feel free to use this as a starting point for your own projects.
