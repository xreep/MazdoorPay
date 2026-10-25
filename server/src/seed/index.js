import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Site } from '../models/Site.js';
import { Worker } from '../models/Worker.js';
import { Attendance } from '../models/Attendance.js';
import { Payment } from '../models/Payment.js';
import connectDB from '../config/db.js';

const INDIAN_WORKERS = [
  { name: 'Ramesh Kumar', role: 'labourer', rate: 450 },
  { name: 'Suresh Mehta', role: 'labourer', rate: 420 },
  { name: 'Vijay Patel', role: 'mason', rate: 800 },
  { name: 'Arjun Singh', role: 'mason', rate: 850 },
  { name: 'Rajesh Yadav', role: 'electrician', rate: 900 },
  { name: 'Manoj Sharma', role: 'electrician', rate: 880 },
  { name: 'Sunil Tiwari', role: 'plumber', rate: 650 },
  { name: 'Dinesh Chauhan', role: 'plumber', rate: 620 },
  { name: 'Ravi Verma', role: 'carpenter', rate: 750 },
  { name: 'Prakash Joshi', role: 'carpenter', rate: 720 },
  { name: 'Kishan Lal', role: 'helper', rate: 350 },
  { name: 'Brijesh Kumar', role: 'helper', rate: 340 },
  { name: 'Raju Das', role: 'labourer', rate: 430 },
  { name: 'Rahul Ansari', role: 'mason', rate: 780 },
  { name: 'Sanjay Bora', role: 'labourer', rate: 410 },
  { name: 'Amit Dubey', role: 'electrician', rate: 950 },
  { name: 'Rohit Negi', role: 'helper', rate: 360 },
  { name: 'Naresh Rawat', role: 'painter', rate: 600 },
  { name: 'Kamal Pandey', role: 'welder', rate: 820 },
  { name: 'Mohan Bisht', role: 'labourer', rate: 440 },
  { name: 'Laxmi Prasad', role: 'helper', rate: 330 },
  { name: 'Gopal Krishnan', role: 'carpenter', rate: 700 },
  { name: 'Hari Om', role: 'mason', rate: 790 },
  { name: 'Deepak Saini', role: 'plumber', rate: 630 },
  { name: 'Sohan Lal', role: 'electrician', rate: 870 },
];

const randomStatus = () => {
  const r = Math.random();
  if (r < 0.78) return 'present';
  if (r < 0.90) return 'absent';
  return 'half-day';
};

const seed = async () => {
  await connectDB();

  if (process.env.SEED_MODE !== 'true') {
    throw new Error('Set SEED_MODE=true to run the seed script');
  }

  // Idempotent: clear existing seed data
  await Payment.deleteMany({});
  await Attendance.deleteMany({});
  await Worker.deleteMany({});
  await Site.deleteMany({});
  await User.deleteMany({ role: 'contractor' });
  await User.deleteMany({ email: 'admin@mazdoorpay.example' });

  const passwordHash = await bcrypt.hash('Password123', 10);
  const adminHash = await bcrypt.hash('AdminPass123', 10);

  const contractor1 = await User.create({
    name: 'Ravi Contractor',
    email: 'ravi.contractor@example.com',
    passwordHash,
    phone: '9876543210',
    role: 'contractor',
  });
  const contractor2 = await User.create({
    name: 'Sunil Builder',
    email: 'sunil.builder@example.com',
    passwordHash,
    phone: '9123456780',
    role: 'contractor',
  });
  const admin = await User.create({
    name: 'System Admin',
    email: 'admin@mazdoorpay.example',
    passwordHash: adminHash,
    phone: '9000000000',
    role: 'admin',
  });

  const site1 = await Site.create({
    name: 'Greenwood Residency',
    location: 'MG Road, Bengaluru',
    contractorId: contractor1._id,
    isActive: true,
  });
  const site2 = await Site.create({
    name: 'Skyline Towers',
    location: 'Bandra West, Mumbai',
    contractorId: contractor1._id,
    isActive: true,
  });
  const site3 = await Site.create({
    name: 'Hillview Apartments',
    location: 'Salt Lake, Kolkata',
    contractorId: contractor2._id,
    isActive: true,
  });

  // Split workers across the two contractors
  const c1Workers = INDIAN_WORKERS.slice(0, 13);
  const c2Workers = INDIAN_WORKERS.slice(13);

  const createWorkers = (contractor, sites, list) => {
    return list.map((w, i) =>
      Worker.create({
        name: w.name,
        role: w.role,
        dailyWageRate: w.rate,
        phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        siteId: sites[i % sites.length]._id,
        contractorId: contractor._id,
        isActive: true,
        joinedAt: new Date(2024, 0, 1),
      })
    );
  };

  const workers1 = await Promise.all(createWorkers(contractor1, [site1, site2], c1Workers));
  const workers2 = await Promise.all(createWorkers(contractor2, [site3], c2Workers));

  // 30 days of mixed attendance ending yesterday
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  endDate.setHours(0, 0, 0, 0);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 29);

  const attendanceDocs = [];
  for (const worker of [...workers1, ...workers2]) {
    let d = new Date(startDate);
    while (d <= endDate) {
      attendanceDocs.push({
        workerId: worker._id,
        siteId: worker.siteId,
        contractorId: worker.contractorId,
        date: new Date(d),
        status: randomStatus(),
        markedBy: worker.contractorId === contractor1._id ? contractor1._id : contractor2._id,
      });
      d.setDate(d.getDate() + 1);
    }
  }
  await Attendance.insertMany(attendanceDocs, { ordered: false });

  // A handful of payments, leaving pending dues
  const now = new Date();
  const payments = [];
  for (const worker of workers1.slice(0, 6)) {
    payments.push({
      workerId: worker._id,
      siteId: worker.siteId,
      contractorId: contractor1._id,
      amount: worker.dailyWageRate * 5,
      date: new Date(now),
      method: 'cash',
      notes: 'Weekly advance',
      recordedBy: contractor1._id,
    });
  }
  for (const worker of workers2.slice(0, 4)) {
    payments.push({
      workerId: worker._id,
      siteId: worker.siteId,
      contractorId: contractor2._id,
      amount: worker.dailyWageRate * 3,
      date: new Date(now),
      method: 'upi',
      notes: 'Partial payment',
      recordedBy: contractor2._id,
    });
  }
  await Payment.insertMany(payments, { ordered: false });

  // eslint-disable-next-line no-console
  console.log('Seed complete:');
  // eslint-disable-next-line no-console
  console.log(`  Contractor 1: ${contractor1.email}`);
  // eslint-disable-next-line no-console
  console.log(`  Contractor 2: ${contractor2.email}`);
  // eslint-disable-next-line no-console
  console.log(`  Admin: ${admin.email}`);
  // eslint-disable-next-line no-console
  console.log(`  Sites: ${await Site.countDocuments()}`);
  // eslint-disable-next-line no-console
  console.log(`  Workers: ${await Worker.countDocuments()}`);
  // eslint-disable-next-line no-console
  console.log(`  Attendance records: ${await Attendance.countDocuments()}`);
  // eslint-disable-next-line no-console
  console.log(`  Payments: ${await Payment.countDocuments()}`);

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed', err);
  process.exit(1);
});
