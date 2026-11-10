# MediCare Online – Online Pharmacy with Doctor Prescription Verification

Open `index.html` in any browser. No build step or server needed.

## Features
- Medicine catalogue (OTC + prescription-only), search, category filters
- Cart drawer with quantities, delivery fee logic, checkout form
- Prescription medicines are LOCKED at checkout until a prescription is verified
- Prescription form: patient, doctor name, medical registration number (format-checked),
  clinic, date (must be within 30 days), medicines covered, file upload (JPG/PNG/PDF, 5 MB)
- Checkout also checks that every Rx item in the cart is covered by the verified prescription
- Pharmacist panel (footer link, demo password `pharma123`) to approve / reject

## Files
- index.html – structure
- css/style.css – responsive styling
- js/data.js – product list (edit to add medicines)
- js/app.js – cart, prescription verification, checkout logic

## Important
This is a front-end prototype. Verification is simulated with localStorage.
For a real pharmacy you need a backend that: verifies the doctor's registration with the
medical council, stores prescriptions securely, enforces the Rx check server-side,
and complies with local pharmacy/drug regulations (e.g. India: Drugs & Cosmetics Act, licensed pharmacist).
