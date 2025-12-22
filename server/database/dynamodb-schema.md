# DynamoDB Schema Design

## Tables

### 1. doctors
- **Partition Key**: `id` (String)
- **Attributes**:
  - `username` (String) - Unique, use GSI for lookups
  - `password_hash` (String)
  - `name` (String)
  - `created_at` (String - ISO timestamp)
  - `updated_at` (String - ISO timestamp)

**Global Secondary Index (GSI)**:
- `username-index`: Partition Key = `username` (for login lookups)

### 2. patients
- **Partition Key**: `doctor_id` (String) - Doctor who owns this patient record
- **Sort Key**: `patient_id` (String - UUID)
- **Attributes**:
  - `nic` (String) - National ID Card number (optional)
  - `name` (String)
  - `birthday` (String - ISO date format YYYY-MM-DD)
  - `phone_number` (String)
  - `gender` (String)
  - `pastMedicalHistory` (String)
  - `familyHistory` (String)
  - `allergies` (String)
  - `drug_history` (List of Maps, optional) - Drug history maintained by this doctor for this patient:
    - `medicine_id` (String)
    - `medicine_name` (String) - For display purposes
    - `brand` (String) - Optional brand name
    - `dose` (String) - Dosage information
  - `created_at` (String - ISO timestamp)
  - `updated_at` (String - ISO timestamp)

**Global Secondary Indexes (GSI)**:
- `doctor-search-index`: Partition Key = `doctor_id`, Sort Key = `search_key` (for searching patients by name, NIC, phone, or birthday)
  - `search_key` is a composite field: `name#nic#phone#birthday` (lowercase, normalized)

**Note**: Patients are unique per doctor. The same person can have separate records for different doctors. The primary key structure (doctor_id + patient_id) ensures efficient querying of all patients for a specific doctor.

### 3. visits
- **Partition Key**: `patient_id` (String - UUID)
- **Sort Key**: `date` (String - ISO timestamp)
- **Attributes**:
  - `id` (String - UUID)
  - `doctor_id` (String)
  - `notes` (String)
  - `presentingComplaint` (String)
  - `examinationFindings` (String)
  - `investigations` (String)
  - `prescriptions` (List of Maps):
    - `medicine_id` (String)
    - `brand` (String)
    - `amount` (String)
  - `referralLetter` (Map, optional):
    - `referralDoctorName` (String)
    - `referralLetterBody` (String)
  - `created_at` (String - ISO timestamp)

**Global Secondary Index (GSI)**:
- `doctor-visits-index`: Partition Key = `doctor_id`, Sort Key = `date` (for querying visits by doctor)

**Note**: Multiple visits per patient per doctor per day are allowed. Each visit is uniquely identified by its `id` and `date` timestamp.

### 4. medicines (Reference Data)
- **Partition Key**: `id` (String)
- **Attributes**:
  - `name` (String)
  - `created_at` (String - ISO timestamp)

Note: Medicines can be stored in DynamoDB or as static data in the Lambda function. For simplicity, we'll use DynamoDB.

**Note**: The `drug_history` field in the patients table stores drug history unique per patient-doctor pair. Each doctor maintains their own list of drugs for each patient. This is separate from visit prescriptions and is meant to track ongoing medications prescribed by other doctors or maintained by this doctor across visits.

## Access Patterns

1. **Login**: Query `doctors` table by `username` (using GSI)
2. **Get Medicines**: Scan or Query `medicines` table
3. **Search Patient**: Query `patients` table by `doctor_id` using GSI, filter by name/NIC/phone/birthday
4. **Get Patient**: Get item from `patients` table by `patient_id`
5. **Get Patient Visits**: Query `visits` table by `patient_id` (partition key)
6. **Create Visit**: Put item to `visits` table, update `patients` table
7. **Get Doctor's Visits**: Query `visits` table by `doctor_id` using GSI
8. **Get Doctor's Patients**: Query `patients` table by `doctor_id` using GSI

