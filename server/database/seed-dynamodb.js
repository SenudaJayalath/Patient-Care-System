#!/usr/bin/env node
/**
 * Seed DynamoDB tables with initial data
 * 
 * Usage:
 *   node database/seed-dynamodb.js
 * 
 * Environment variables:
 *   AWS_REGION (default: us-east-1)
 *   AWS_ENDPOINT (optional, for local DynamoDB)
 */

import {
	putItem,
	TABLES
} from '../src/db-dynamodb.js';

// Set table names if not set via environment
if (!process.env.DYNAMODB_DOCTORS_TABLE) {
	TABLES.DOCTORS = 'doctor-visit-logger-doctors-dev';
	TABLES.PATIENTS = 'doctor-visit-logger-patients-dev';
	TABLES.VISITS = 'doctor-visit-logger-visits-dev';
	TABLES.DOCTOR_ITEMS = 'doctor-visit-logger-doctor-items-dev';
}

async function seed() {
	try {
		console.log('Seeding DynamoDB tables...');

		// Seed default doctor first
		console.log('Seeding default doctor...');
		const doctor = {
			id: 'doc-1',
			username: 'doctor1',
			password_hash: 'pass123', // In production, use bcrypt hash
			name: 'Smith',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		await putItem(TABLES.DOCTORS, doctor);
		console.log(`  ✓ ${doctor.name} (username: ${doctor.username})`);

		const doctorId = doctor.id;

		// Seed medicines with brands (linked to doctor)
		console.log('Seeding medicines for doctor...');
		const medicines = [
			{ 
				id: 'med-1', 
				name: 'Paracetamol', 
				brands: ['Panadol', 'Tylenol', 'Calpol'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-2', 
				name: 'Amoxicillin', 
				brands: ['Amoxil', 'Trimox', 'Moxatag'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-3', 
				name: 'Ibuprofen', 
				brands: ['Advil', 'Motrin', 'Nurofen'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-4', 
				name: 'Cetirizine', 
				brands: ['Zyrtec', 'Reactine', 'Aller-Tec'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-5', 
				name: 'Omeprazole', 
				brands: ['Prilosec', 'Losec', 'Gastrul'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-6', 
				name: 'Aspirin', 
				brands: ['Bayer', 'Ecotrin', 'Aspirin'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-7', 
				name: 'Metformin', 
				brands: ['Glucophage', 'Fortamet', 'Riomet'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-8', 
				name: 'Amlodipine', 
				brands: ['Norvasc', 'Katerzia', 'Amlodipine'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-9', 
				name: 'Atorvastatin', 
				brands: ['Lipitor', 'Atorvastatin', 'Torvast'],
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'med-10', 
				name: 'Losartan', 
				brands: ['Cozaar', 'Losartan', 'Hyzaar'],
				created_at: new Date().toISOString() 
			}
		];

		// Create single medicine row with list of all medicines
		const medicineRow = {
			doctor_id: doctorId,
			item_type: 'M',
			items: medicines.map(m => ({
				id: m.id,
				name: m.name,
				brands: m.brands
			})),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		await putItem(TABLES.DOCTOR_ITEMS, medicineRow);
		console.log(`  ✓ Seeded ${medicines.length} medicines`);

		// Seed investigations/tests (linked to doctor)
		console.log('Seeding investigations for doctor...');
		const investigations = [
			{ 
				id: 'inv-1', 
				name: 'Complete Blood Count (CBC)', 
				category: 'Hematology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-2', 
				name: 'Blood Sugar (Fasting)', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-3', 
				name: 'Blood Sugar (Random)', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-4', 
				name: 'HbA1c (Glycated Hemoglobin)', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-5', 
				name: 'Lipid Profile', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-6', 
				name: 'Liver Function Test (LFT)', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-7', 
				name: 'Kidney Function Test (KFT)', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-8', 
				name: 'Thyroid Function Test (TFT)', 
				category: 'Endocrinology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-9', 
				name: 'X-Ray Chest', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-10', 
				name: 'X-Ray Abdomen', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-11', 
				name: 'X-Ray Skull', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-12', 
				name: 'X-Ray Spine', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-13', 
				name: 'ECG (Electrocardiogram)', 
				category: 'Cardiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-14', 
				name: 'Echocardiogram', 
				category: 'Cardiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-15', 
				name: 'Ultrasound Abdomen', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-16', 
				name: 'Ultrasound Pelvis', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-17', 
				name: 'Urine Analysis', 
				category: 'Pathology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-18', 
				name: 'Urine Culture & Sensitivity', 
				category: 'Microbiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-19', 
				name: 'Stool Analysis', 
				category: 'Pathology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-20', 
				name: 'Stool Culture', 
				category: 'Microbiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-21', 
				name: 'Blood Culture & Sensitivity', 
				category: 'Microbiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-22', 
				name: 'ESR (Erythrocyte Sedimentation Rate)', 
				category: 'Hematology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-23', 
				name: 'CRP (C-Reactive Protein)', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-24', 
				name: 'Vitamin D', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-25', 
				name: 'Vitamin B12', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-26', 
				name: 'Folate', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-27', 
				name: 'Serum Creatinine', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-28', 
				name: 'Urea', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-29', 
				name: 'Uric Acid', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-30', 
				name: 'CT Scan Head', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-31', 
				name: 'CT Scan Chest', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-32', 
				name: 'CT Scan Abdomen', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-33', 
				name: 'MRI Brain', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-34', 
				name: 'MRI Spine', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-35', 
				name: 'Mammography', 
				category: 'Radiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-36', 
				name: 'Pap Smear', 
				category: 'Pathology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-37', 
				name: 'PSA (Prostate Specific Antigen)', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-38', 
				name: 'Tumor Markers', 
				category: 'Oncology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-39', 
				name: 'HIV Test', 
				category: 'Serology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-40', 
				name: 'Hepatitis B Surface Antigen (HBsAg)', 
				category: 'Serology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-41', 
				name: 'Hepatitis C Antibody', 
				category: 'Serology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-42', 
				name: 'Dengue NS1 Antigen', 
				category: 'Serology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-43', 
				name: 'Malaria Parasite Test', 
				category: 'Parasitology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-44', 
				name: 'Sputum Culture & Sensitivity', 
				category: 'Microbiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-45', 
				name: 'Throat Swab Culture', 
				category: 'Microbiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-46', 
				name: 'Wound Swab Culture', 
				category: 'Microbiology',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-47', 
				name: 'Serum Electrolytes', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-48', 
				name: 'Serum Calcium', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-49', 
				name: 'Serum Phosphorus', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			},
			{ 
				id: 'inv-50', 
				name: 'Serum Magnesium', 
				category: 'Biochemistry',
				created_at: new Date().toISOString() 
			}
		];

		// Create single investigation row with list of all investigations
		const investigationRow = {
			doctor_id: doctorId,
			item_type: 'I',
			items: investigations.map(inv => ({
				id: inv.id,
				name: inv.name,
				category: inv.category
			})),
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		await putItem(TABLES.DOCTOR_ITEMS, investigationRow);
		console.log(`  ✓ Seeded ${investigations.length} investigations`);

		console.log('\n✅ Seeding completed successfully!');
	} catch (error) {
		console.error('❌ Seeding failed:', error.message);
		process.exit(1);
	}
}

seed();

