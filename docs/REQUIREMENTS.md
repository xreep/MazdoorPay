# Daily Wage Labour Attendance & Payment Platform — Official Requirements

Source: project brief (Unified Mentor). Kept verbatim in substance as the roadmap MazdoorPay is evaluated against.

## Context

The construction sector employs a large number of daily wage labourers, including skilled and unskilled workers. Contractors and site managers are responsible for managing attendance, wage calculations, and payments for these workers.

Most construction sites still rely on manual attendance registers and cash-based payments, which can lead to errors, delays, disputes, and lack of transparency. Tracking worker attendance across multiple sites and ensuring timely payments becomes challenging.

The platform aims to digitize workforce management by providing tools to:

- Mark daily attendance
- Calculate wages automatically
- Track payments and dues
- Maintain transparent records

References: [Unified Mentor](https://www.unifiedmentor.com/), [Ministry of Labour and Employment](https://labour.gov.in/), [BOCW Welfare Board](https://bocw.gov.in/), [International Labour Organization](https://www.ilo.org/)

## Problem Statement

- Manual attendance tracking leads to errors
- Wage calculation is time-consuming and prone to mistakes
- Lack of transparency in payments
- Difficulty managing multiple workers and sites
- Disputes between workers and contractors

## Primary Objectives

- Digitize attendance tracking for daily wage workers
- Automate wage calculation based on attendance
- Enable transparent payment tracking
- Improve workforce management efficiency
- Reduce disputes and errors

## Secondary Objectives

- Provide reports for labour compliance
- Track worker history and performance
- Enable easy record-keeping for contractors
- Promote digital adoption in the construction sector

## Scope

### In-Scope (Phase 1)

- User registration and login
- Worker management system
- Attendance tracking module
- Wage calculation system
- Payment tracking module
- Admin management panel

### Out of Scope (Phase 1)

- Direct digital payment integration
- Biometric attendance systems
- Government compliance filing automation
- Mobile application version

## Functional Requirements

1. **Contractor Module** — Register/Login; create and manage construction sites; add and manage workers; mark daily attendance; track wages and payments.
2. **Worker Management Module** — Add worker details (name, role, wage rate); maintain worker profiles; track work history; assign workers to sites.
3. **Attendance Module** — Mark daily attendance (present/absent/half-day); view attendance records; generate attendance reports; track attendance history.
4. **Wage Calculation Module** — Calculate wages based on attendance; support daily/weekly wage calculations; show total earnings and pending payments; generate wage summaries.
5. **Payment Tracking Module** — Record payments made to workers; track pending dues; maintain payment history; generate payment reports.
6. **Admin Module** — Manage users and contractors; monitor system usage; ensure data accuracy; generate analytics reports.

## Non-Functional Requirements

- Security: Secure authentication system
- Usability: Simple and easy-to-use interface (low digital literacy friendly)
- Accessibility: Mobile-responsive design
- Performance: Fast performance
- Data: Secure data storage
- Scalability: Scalable architecture

## Technology Stack (Suggested)

- Frontend: HTML5, CSS3, JavaScript, React.js
- Backend: Node.js, Express.js
- Database: MongoDB / PostgreSQL
- Deployment: AWS / Render / Vercel

## User Flow (High Level)

- **Contractor:** Register/Login → Create site → Add workers → Mark attendance → Track wages → Record payments
- **Admin:** Manage users → Monitor activity → Generate reports

## Data Requirements

- **Worker:** name, role (mason, labourer, electrician, etc.), daily wage rate, assigned site
- **Attendance:** worker name, date, attendance status
- **Payment:** worker name, payment amount, payment date, pending dues

## Key Performance Indicators

- Number of contractors using the platform
- Number of workers managed
- Attendance records created
- Payment tracking accuracy
- User engagement rate

## Assumptions & Constraints

- Assumptions: contractors are willing to digitize records; workers accept digital tracking; internet access is available at sites.
- Constraints: digital literacy levels vary; data accuracy depends on manual entry; payment handling may remain partially offline.

## Deliverables

- Fully functional Labour Management Platform
- Attendance tracking system
- Wage calculation module
- Payment tracking system
- Admin panel
- Live deployed application link
- Complete PRD document

## Expected Impact

Improved transparency in wage payments; reduced disputes; efficient workforce management; better compliance with labour regulations; increased digital adoption.

## Future Enhancements

- Mobile application for on-site usage
- Biometric or QR-based attendance system
- Digital payment integration (UPI, bank transfer)
- Government compliance reporting
- Multi-language support

## Project Guidelines & Implementation Notes

- 6–8 interconnected pages (Login, Contractor Dashboard, Worker Management, Attendance, Wage Calculation, Payment Tracking, Admin Panel)
- Attendance and payment tracking features must function properly
- Use realistic labour data instead of placeholder content
- Proper validation and secure authentication must be implemented
- The application must be fully tested before submission
- Only a live deployed link will be accepted for final evaluation
