// Demo data for MazdoorPay. Names, places and rates are realistic for Indian construction sites (2026).

// The demo passwords are not here: they come from DEMO_PASSWORD and DEMO_ADMIN_PASSWORD.
export const ADMIN = {
  name: 'Asha Rao',
  email: 'admin@mazdoorpay.in',
  phone: '9845012345',
};

export const CONTRACTORS = [
  {
    name: 'Ravi Kumar',
    email: 'ravi.kumar@mazdoorpay.in',
    phone: '9886543210',
    sites: [
      {
        name: 'Prestige Lakeside – Whitefield',
        location: 'Varthur Road, Whitefield, Bengaluru 560066',
      },
      { name: 'Sobha Tower – Hebbal', location: 'Bellary Road, Hebbal, Bengaluru 560024' },
    ],
    workerCount: 16,
  },
  {
    name: 'Sunita Patil',
    email: 'sunita.patil@mazdoorpay.in',
    phone: '9822012345',
    sites: [
      {
        name: 'Kolte Patil Life Republic – Hinjewadi',
        location: 'Marunji Road, Hinjewadi, Pune 411057',
      },
      { name: 'Andheri East Metro Depot', location: 'MIDC, Andheri East, Mumbai 400093' },
    ],
    workerCount: 14,
  },
];

// Daily rates in rupees.
export const WORKERS = [
  { name: 'Ramesh Kumar', role: 'labourer', rate: 650 },
  { name: 'Suresh Mehta', role: 'labourer', rate: 620 },
  { name: 'Vijay Patel', role: 'mason', rate: 950 },
  { name: 'Arjun Singh', role: 'mason', rate: 1000 },
  { name: 'Rajesh Yadav', role: 'electrician', rate: 1100 },
  { name: 'Manoj Sharma', role: 'electrician', rate: 1050 },
  { name: 'Sunil Tiwari', role: 'plumber', rate: 900 },
  { name: 'Dinesh Chauhan', role: 'plumber', rate: 880 },
  { name: 'Ravi Verma', role: 'carpenter', rate: 950 },
  { name: 'Prakash Joshi', role: 'carpenter', rate: 920 },
  { name: 'Kishan Lal', role: 'helper', rate: 550 },
  { name: 'Brijesh Kumar', role: 'helper', rate: 540 },
  { name: 'Raju Das', role: 'labourer', rate: 630 },
  { name: 'Rahul Ansari', role: 'mason', rate: 980 },
  { name: 'Sanjay Bora', role: 'labourer', rate: 610 },
  { name: 'Amit Dubey', role: 'electrician', rate: 1150 },
  { name: 'Rohit Negi', role: 'helper', rate: 560 },
  { name: 'Naresh Rawat', role: 'painter', rate: 800 },
  { name: 'Kamal Pandey', role: 'welder', rate: 1050 },
  { name: 'Mohan Bisht', role: 'labourer', rate: 640 },
  { name: 'Laxmi Prasad', role: 'helper', rate: 530 },
  { name: 'Gopal Krishnan', role: 'carpenter', rate: 900 },
  { name: 'Hari Om Gupta', role: 'mason', rate: 990 },
  { name: 'Deepak Saini', role: 'plumber', rate: 870 },
  { name: 'Sohan Lal Meena', role: 'electrician', rate: 1080 },
  { name: 'Savitri Devi', role: 'labourer', rate: 600 },
  { name: 'Abdul Karim', role: 'welder', rate: 1020 },
  { name: 'Lakshmi Bai', role: 'helper', rate: 540 },
  { name: 'Mahesh Gowda', role: 'painter', rate: 820 },
  { name: 'Imran Shaikh', role: 'mason', rate: 970 },
];

export const PAYMENT_NOTES = ['Weekly wages', 'Saturday payout', 'Paid at site office', ''];
export const ADVANCE_NOTES = [
  'Medical expenses',
  "Child's school fees",
  'Travel to village',
  'Festival advance',
];
