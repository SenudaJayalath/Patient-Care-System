# Doctor Visit Logger

A full-stack application for doctors to manage patient visits, prescriptions, and medical history. Built with React (Vite) frontend and Node.js/Express backend with in-memory database.

## Features

- **Doctor Authentication**: Secure login system for doctors
- **Patient Management**: 
  - Enter patient NIC to search for existing patients
  - View patient history and previous visits
  - Add new visits for both existing and new patients
- **Medicine Selection**:
  - Tag-style multi-select medicine picker
  - Search functionality to find medicines quickly
  - Add multiple medicines by searching and selecting
  - Remove selected medicines with a click
- **Prescription Generation**: 
  - Generate printable prescriptions
  - Download as PDF via browser print dialog
  - View prescriptions for both new and historical visits

## Tech Stack

- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express
- **Database**: In-memory (for development)

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm run dev
```

The server will start on `http://localhost:4000`

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:5173` (or another port if 5173 is busy)

## Default Credentials

- **Username**: `doctor1`
- **Password**: `pass123`

## Usage Flow

1. **Login**: Enter credentials on the login page
2. **Enter NIC**: After login, enter the patient's NIC number
   - If patient exists: Previous history will be displayed
   - If new patient: Empty form will be shown
3. **Add Visit**: 
   - Name and Age are pre-filled for existing patients (can be edited for new patients)
   - Search for medicines and select multiple
   - Selected medicines appear as tags with remove buttons
   - Submit to save the visit
4. **Generate Prescription**: 
   - After saving, click "View / Download Prescription"
   - Use browser print dialog to save as PDF
5. **Next Patient**: Click "Next Patient" to clear the form and start fresh

## Medicine Selection

- Type in the search box to filter medicines
- Click on a medicine from the dropdown to add it
- Selected medicines appear as tags above the search box
- Click the × button on any tag to remove it
- You can search multiple times and add multiple medicines

## API Endpoints

- `POST /api/login` - Doctor login
- `POST /api/logout` - Doctor logout
- `GET /api/medicines` - Get list of medicines (requires auth)
- `POST /api/visits` - Create a new visit (requires auth)
- `GET /api/patients/:nic` - Get patient by NIC (requires auth)

## Project Structure

```
Doc-DB/
├── server/
│   ├── src/
│   │   └── server.js
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   └── visits/
│   │   │       ├── AddVisitForm.jsx
│   │   │       ├── PrescriptionModal.jsx
│   │   │       └── PrescriptionUtil.js
│   │   ├── auth/
│   │   │   └── AuthContext.jsx
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Development Notes

- The database is in-memory, so data is lost on server restart
- Authentication tokens are stored in localStorage
- The application uses a simple token-based authentication system
- All API calls require authentication except login

## License

This project is for educational/training purposes.

