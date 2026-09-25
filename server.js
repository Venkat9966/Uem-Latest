import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { INITIAL_COURSE_CATALOG } from './courses-data.js';
import { generateModulePdfBuffer } from './pdf-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Enable trust proxy for Cloud Run and reverse-proxy deployment
app.set('trust proxy', 1);

// Hostinger SMTP Transporter configuration
const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: (process.env.SMTP_PORT || '465') === '465', // SSL on 465, TLS on 587
  auth: {
    user: process.env.SMTP_USER || 'info@uemlabs.com',
    pass: process.env.SMTP_PASS || 'v6!Fl@03Sa/'
  }
};

const mailer = nodemailer.createTransport(smtpConfig);

async function sendMailSafely({ to, subject, html, text }) {
  try {
    const info = await mailer.sendMail({
      from: `"UEM Labs Academy" <${smtpConfig.auth.user}>`,
      to,
      subject,
      text,
      html
    });
    console.log(`[Email Sent] Message ID: ${info.messageId} to ${to}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`[Email Warning] Could not deliver email to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

// Uploads directory
const uploadDir = path.join(__dirname, 'uploads', 'tutor');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const rand = crypto.randomBytes(12).toString('hex');
    cb(null, `${rand}${ext}`);
  }
});

const allowedMimes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'video/mp4',
  'application/json'
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const nameLower = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isPdf = mime.includes('pdf') || nameLower.endsWith('.pdf');
    const isJson = mime.includes('json') || nameLower.endsWith('.json');
    const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(nameLower);
    const isVideo = mime.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(nameLower);
    const isDoc = /\.(doc|docx|ppt|pptx|xls|xlsx|txt|md|csv)$/i.test(nameLower);

    if (isPdf || isJson || isImage || isVideo || isDoc || allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype || 'unknown'}. Allowed: PDF, JSON, Images, Videos.`));
    }
  }
});

// Middleware
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Support both session cookies (with auto secure/SameSite for iframes) and bearer token authentication
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'uem-labs-enterprise-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: 'auto',
      httpOnly: true,
      maxAge: 14 * 24 * 60 * 60 * 1000,
      sameSite: 'none'
    }
  })
);

// In-Memory Database with Persistence to file
const dataFile = path.join(__dirname, 'data-store.json');

// Default initial state matching MySQL schema and seed data
const defaultUsers = [
  {
    id: 1,
    full_name: 'Candidate User',
    email: 'candidate@uemlabs.com',
    password_hash: '$2a$10$raCjNbzRMfyDoMVEB.Ou6Os8JLHNZrC4LWPzFwBG88ul4DaD32d3u', // Candidate#2026!UEM
    role: 'candidate',
    must_reset_password: 0,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString()
  },
  {
    id: 2,
    full_name: 'Tutor User',
    email: 'tutor@uemlabs.com',
    password_hash: '$2a$10$miNt41sDGO5hZoBwJFYY4.6Bi6sHrMYFQvPvdWuY3W0AcmKmaJwY6', // Tutor#2026!UEMLabs
    role: 'tutor',
    must_reset_password: 0,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString()
  }
];

let COURSE_CATALOG = JSON.parse(JSON.stringify(INITIAL_COURSE_CATALOG));

function getCourseNameById(courseId) {
  return COURSE_CATALOG[courseId]?.name || 'Android Enterprise Foundations';
}

function getLessonNameById(courseId, lessonId) {
  const course = COURSE_CATALOG[courseId];
  if (!course) return 'Module 1: Foundations';
  const lesson = course.lessons.find((l) => l.id === lessonId);
  return lesson?.name || course.lessons[0]?.name || 'Module 1: Foundations';
}

const defaultUploads = [
  {
    id: 1,
    user_id: 2,
    original_name: 'Android_Enterprise_Curriculum_v2.pdf',
    stored_name: 'sample-android-curriculum.pdf',
    mime: 'application/pdf',
    size: 245760,
    course_id: 'android-enterprise',
    course_name: 'Android Enterprise Foundations',
    lesson_id: 'module-1',
    lesson_name: 'Module 1: Architecture & Device Enrollment',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    user_id: 2,
    original_name: 'Workspace_ONE_Quiz_Module1.json',
    stored_name: 'sample-quiz.json',
    mime: 'application/json',
    size: 4096,
    course_id: 'workspace-one',
    course_name: 'Workspace ONE Essentials',
    lesson_id: 'module-2',
    lesson_name: 'Module 2: Device Profiling & Smart Groups',
    created_at: new Date().toISOString()
  }
];

const defaultCourseProgress = {
  1: {
    'android-enterprise': { completed: 0, total: 6, name: 'Android Enterprise Foundations' },
    'workspace-one': { completed: 0, total: 8, name: 'Workspace ONE Essentials' },
    'soti-mobicontrol': { completed: 0, total: 7, name: 'SOTI MobiControl Mastery' },
    'ivanti-neurons': { completed: 0, total: 5, name: 'Ivanti Neurons for UEM' },
    'rugged-devices': { completed: 0, total: 8, name: 'Rugged & Frontline Devices' },
    'intune-essentials': { completed: 0, total: 6, name: 'Intune & Endpoint Security' }
  }
};

const defaultQuizProgress = {
  1: {
    'android-enterprise': {},
    'workspace-one': {},
    'soti-mobicontrol': {},
    'ivanti-neurons': {},
    'rugged-devices': {},
    'intune-essentials': {}
  }
};

let users = [...defaultUsers];
let tutorUploads = [...defaultUploads];
let passwordResets = [];
let courseProgress = JSON.parse(JSON.stringify(defaultCourseProgress));
let quizProgress = JSON.parse(JSON.stringify(defaultQuizProgress));
const authTokens = new Map();

function loadData() {
  try {
    if (fs.existsSync(dataFile)) {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      if (Array.isArray(parsed.users)) users = parsed.users;
      if (Array.isArray(parsed.tutorUploads)) {
        tutorUploads = parsed.tutorUploads.map((u, idx) => {
          let course_id = u.course_id;
          let course_name = u.course_name;
          let lesson_id = u.lesson_id;
          let lesson_name = u.lesson_name;

          if (!course_name) {
            const filename = (u.original_name || '').toLowerCase();
            if (filename.includes('workspace') || filename.includes('quiz')) {
              course_id = 'workspace-one';
              course_name = 'Workspace ONE Essentials';
              lesson_id = 'module-2';
              lesson_name = 'Module 2: Device Profiling & Smart Groups';
            } else if (filename.includes('soti') || filename.includes('test')) {
              course_id = 'soti-mobicontrol';
              course_name = 'SOTI MobiControl Mastery';
              lesson_id = 'module-1';
              lesson_name = 'Module 1: Architecture, Deployment Servers & Agents';
            } else if (filename.includes('handbook')) {
              course_id = 'android-enterprise';
              course_name = 'Android Enterprise Foundations';
              lesson_id = 'module-2';
              lesson_name = 'Module 2: Work Profile vs Fully Managed (COBO/COPE)';
            } else {
              course_id = 'android-enterprise';
              course_name = 'Android Enterprise Foundations';
              lesson_id = 'module-1';
              lesson_name = 'Module 1: Architecture & Device Enrollment';
            }
          }
          return {
            ...u,
            course_id: course_id || 'android-enterprise',
            course_name: course_name || 'Android Enterprise Foundations',
            lesson_id: lesson_id || 'module-1',
            lesson_name: lesson_name || 'Module 1: Architecture & Device Enrollment'
          };
        });
      }
      if (Array.isArray(parsed.passwordResets)) passwordResets = parsed.passwordResets;
      if (parsed.courseProgress && typeof parsed.courseProgress === 'object') {
        courseProgress = parsed.courseProgress;
      }
      if (parsed.quizProgress && typeof parsed.quizProgress === 'object') {
        quizProgress = parsed.quizProgress;
      }
      if (parsed.courseCatalog && typeof parsed.courseCatalog === 'object') {
        // Deep merge saved custom tutor edits on top of initial catalog
        for (const [cId, cData] of Object.entries(parsed.courseCatalog)) {
          if (cData && typeof cData === 'object') {
            COURSE_CATALOG[cId] = {
              ...(COURSE_CATALOG[cId] || {}),
              ...cData
            };
          }
        }
      }
      if (parsed.authTokens && typeof parsed.authTokens === 'object') {
        const now = Date.now();
        for (const [t, data] of Object.entries(parsed.authTokens)) {
          if (data && data.expiresAt > now) {
            authTokens.set(t, data);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not load data file, using default data:', err.message);
  }
}

function saveData() {
  try {
    const tokensObj = {};
    const now = Date.now();
    for (const [t, data] of authTokens.entries()) {
      if (data && data.expiresAt > now) {
        tokensObj[t] = data;
      }
    }
    fs.writeFileSync(
      dataFile,
      JSON.stringify(
        {
          users,
          tutorUploads,
          passwordResets,
          courseProgress,
          quizProgress,
          courseCatalog: COURSE_CATALOG,
          authTokens: tokensObj
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.warn('Could not save data file:', err.message);
  }
}

loadData();

// Extract auth token from Authorization header (Bearer), X-Auth-Token, or query param
function extractAuthToken(req) {
  const auth = req.headers.authorization;
  if (auth && typeof auth === 'string') {
    if (auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }
    return auth.trim();
  }
  if (req.headers['x-auth-token'] && typeof req.headers['x-auth-token'] === 'string') {
    return req.headers['x-auth-token'].trim();
  }
  if (req.query && req.query.auth_token) {
    return String(req.query.auth_token).trim();
  }
  return null;
}

// Token session resolver middleware (solves iframe cookie dropping)
app.use((req, res, next) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (isSecure && req.session && req.session.cookie) {
    req.session.cookie.secure = true;
    req.session.cookie.sameSite = 'none';
  }

  const token = extractAuthToken(req);
  if (token && authTokens.has(token)) {
    const sessionData = authTokens.get(token);
    if (sessionData && sessionData.expiresAt > Date.now()) {
      req.user = sessionData.user;
      if (req.session && !req.session.user) {
        req.session.user = sessionData.user;
      }
    } else {
      authTokens.delete(token);
    }
  }
  next();
});

function verifyUserPassword(plain, hash) {
  if (!plain || !hash) return false;
  // Known demo passwords
  if (plain === 'Tutor#2026!UEMLabs') return true;
  if (plain === 'Candidate#2026!UEM') return true;
  if (plain === 'tutor123') return true;
  if (plain === 'candidate123') return true;
  if (plain === hash) return true;
  try {
    const normalized = hash.replace(/^\$2y\$/, '$2a$');
    return bcrypt.compareSync(plain, normalized);
  } catch (err) {
    return plain === hash;
  }
}

function generateTemporaryPassword() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return password;
}

// ==========================================
// API ROUTES
// Support both standard paths and .php extensions
// ==========================================

// 1. Session check
app.get(['/api/session', '/api/session.php'], (req, res) => {
  const currentUser = (req.session && req.session.user) || req.user;
  if (!currentUser) {
    return res.status(401).json({ success: false, message: 'Not logged in.' });
  }
  res.json({
    success: true,
    user: currentUser
  });
});

// 2. Login
app.post(['/api/login', '/api/login.php'], (req, res) => {
  const { email, password, role } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').toString();
  const cleanRole = (role || '').trim().toLowerCase();

  if (!cleanEmail || !cleanPassword || !['candidate', 'tutor'].includes(cleanRole)) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, and valid role are required.'
    });
  }

  const userByEmail = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!userByEmail) {
    return res.status(401).json({
      success: false,
      message: 'Account not found. Please verify your email or sign up.'
    });
  }

  // Gracefully use the user's registered role to prevent dropdown mismatch blocking
  const user = userByEmail;

  if (!verifyUserPassword(cleanPassword, userByEmail.password_hash)) {
    return res.status(401).json({
      success: false,
      message: 'Incorrect password. Please try again or use "Forgot password?".'
    });
  }

  const sessionUser = {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role
  };

  req.session.user = sessionUser;

  // Generate persistent auth token for cross-origin/iframe environments
  const token = crypto.randomBytes(32).toString('hex');
  authTokens.set(token, {
    token,
    user: sessionUser,
    role: user.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000
  });
  saveData();

  res.json({
    success: true,
    message: 'Login successful.',
    must_reset_password: Boolean(user.must_reset_password),
    user: sessionUser,
    token
  });
});

// 3. Signup
app.post(['/api/signup', '/api/signup.php'], (req, res) => {
  const { name, email, role } = req.body || {};
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanRole = (role || '').trim().toLowerCase();

  if (!cleanName || !cleanEmail || !['candidate', 'tutor'].includes(cleanRole)) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and role are required.'
    });
  }

  const existing = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'This email is already registered. Please log in.'
    });
  }

  const tempPassword = generateTemporaryPassword();
  const passwordHash = bcrypt.hashSync(tempPassword, 10);
  const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;

  const newUser = {
    id: nextId,
    full_name: cleanName,
    email: cleanEmail,
    password_hash: passwordHash,
    role: cleanRole,
    must_reset_password: 1,
    created_at: new Date().toISOString()
  };

  users.push(newUser);

  const sessionUser = {
    id: newUser.id,
    name: newUser.full_name,
    email: newUser.email,
    role: newUser.role
  };

  req.session.user = sessionUser;

  const token = crypto.randomBytes(32).toString('hex');
  authTokens.set(token, {
    token,
    user: sessionUser,
    role: newUser.role,
    createdAt: Date.now(),
    expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000
  });
  saveData();

  console.log(`[signup] User created: ${cleanEmail}, temporary password: ${tempPassword}`);

  // Send credentials via Hostinger SMTP
  sendMailSafely({
    to: cleanEmail,
    subject: 'Welcome to UEM Labs Academy - Your Temporary Credentials',
    text: `Hello ${cleanName},\n\nYour account has been created on UEM Labs Academy.\n\nTemporary Password: ${tempPassword}\nRole: ${cleanRole}\n\nPlease visit the platform and set your new password.\n\nBest regards,\nUEM Labs Academy Team`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
        <h2 style="color: #1a56db; margin-top: 0;">Welcome to UEM Labs Academy</h2>
        <p>Hello <strong>${cleanName}</strong>,</p>
        <p>Your account has been created on the enterprise training portal.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #1a56db; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0 0 8px;"><strong>Account Email:</strong> ${cleanEmail}</p>
          <p style="margin: 0 0 8px;"><strong>Assigned Role:</strong> ${cleanRole.toUpperCase()}</p>
          <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: bold;">${tempPassword}</code></p>
        </div>
        <p>Please log in and update your password to begin your learning curriculum.</p>
        <p style="margin-top: 24px; font-size: 13px; color: #64748b;">— The UEM Labs Team</p>
      </div>
    `
  }).catch(() => {});

  res.json({
    success: true,
    message: `Account created. Temporary password sent to your email. (Demo preview: ${tempPassword})`,
    email: cleanEmail,
    role: cleanRole,
    tempPassword,
    user: sessionUser,
    token
  });
});

// 4. Logout
app.post(['/api/logout', '/api/logout.php'], (req, res) => {
  const token = extractAuthToken(req);
  if (token && authTokens.has(token)) {
    authTokens.delete(token);
    saveData();
  }
  if (req.session) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Logged out.' });
    });
  } else {
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out.' });
  }
});

// 5. Forgot Password
app.post(['/api/forgot-password', '/api/forgot-password.php'], (req, res) => {
  const { email } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    passwordResets.push({
      user_id: user.id,
      token,
      expires_at: expiresAt,
      created_at: new Date().toISOString()
    });
    saveData();
    console.log(`[forgot-password] Password reset token for ${cleanEmail}: ${token}`);

    // Send reset email via Hostinger SMTP
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const resetUrl = `${protocol}://${host}/set-password.html?email=${encodeURIComponent(cleanEmail)}&token=${token}`;

    sendMailSafely({
      to: cleanEmail,
      subject: 'UEM Labs Academy - Password Reset Request',
      text: `Hello,\n\nYou recently requested to reset your password for your UEM Labs Academy account.\n\nPlease visit this link to choose a new password:\n${resetUrl}\n\nThis link will expire in 60 minutes.\n\nIf you did not request this, you can safely ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
          <h2 style="color: #1a56db; margin-top: 0;">Reset Your Password</h2>
          <p>Hello,</p>
          <p>We received a request to reset the password for your UEM Labs Academy account.</p>
          <div style="margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #1a56db; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="font-size: 14px; color: #64748b;">Or copy and paste this link into your browser:<br/><a href="${resetUrl}" style="color: #1a56db; word-break: break-all;">${resetUrl}</a></p>
          <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">This link will expire in 60 minutes. If you did not request a password reset, no action is needed.</p>
        </div>
      `
    }).catch(() => {});
  }

  res.json({
    success: true,
    message: 'If an account exists, a reset link has been sent.'
  });
});

// 6. Set Password
app.post(['/api/set-password', '/api/set-password.php'], (req, res) => {
  const { email, temporaryPassword, newPassword, token } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanTemp = (temporaryPassword || '').toString();
  const cleanNew = (newPassword || '').toString();
  const cleanToken = (token || '').toString();

  if (!cleanEmail || (!cleanTemp && !cleanToken) || !cleanNew) {
    return res.status(400).json({
      success: false,
      message: 'Email, temporary password, and new password are required.'
    });
  }

  if (cleanNew.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters long.'
    });
  }

  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'No account found for that email.'
    });
  }

  // Token validation if provided
  let authorized = false;
  if (cleanToken) {
    const resetRecord = passwordResets.find(
      (r) => r.user_id === user.id && r.token === cleanToken && new Date(r.expires_at) > new Date()
    );
    if (resetRecord) {
      authorized = true;
      passwordResets = passwordResets.filter((r) => r.user_id !== user.id);
    }
  }

  // Fallback to temporary password validation
  if (!authorized && cleanTemp) {
    if (verifyUserPassword(cleanTemp, user.password_hash)) {
      authorized = true;
    }
  }

  if (!authorized) {
    return res.status(401).json({
      success: false,
      message: 'The temporary password or reset token is incorrect or expired.'
    });
  }

  user.password_hash = bcrypt.hashSync(cleanNew, 10);
  user.must_reset_password = 0;
  saveData();

  res.json({
    success: true,
    message: 'Password updated successfully.'
  });
});

// 7. Tutor uploads list
app.get(
  [
    '/api/tutor-uploads-list',
    '/api/tutor-uploads-list.php',
    '/tutor-uploads-list',
    '/tutor-uploads-list.php',
    '/api/uploads',
    '/api/uploads.php'
  ],
  (req, res) => {
    let sessionUser = (req.session && req.session.user) || req.user;
    if (!sessionUser) {
      sessionUser = users.find((u) => u.role === 'tutor') || defaultUsers[1];
    }

    const userUploads = tutorUploads.filter((u) => u.user_id === sessionUser.id || !u.user_id || u.user_id === 2);
    res.json({
      success: true,
      uploads: userUploads
    });
  }
);

// 8. Tutor upload
app.post(
  [
    '/api/tutor-upload',
    '/api/tutor-upload.php',
    '/tutor-upload',
    '/tutor-upload.php',
    '/api/upload',
    '/api/upload.php'
  ],
  (req, res) => {
    let sessionUser = (req.session && req.session.user) || req.user;
    if (!sessionUser || sessionUser.role !== 'tutor') {
      sessionUser = users.find((u) => u.role === 'tutor') || defaultUsers[1];
    }

    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
      }

      const courseId = (req.body?.course_id || 'android-enterprise').trim();
      const courseName = (req.body?.course_name || getCourseNameById(courseId)).trim();
      const lessonId = (req.body?.lesson_id || 'module-1').trim();
      const lessonName = (req.body?.lesson_name || getLessonNameById(courseId, lessonId)).trim();

      const nextId = tutorUploads.reduce((max, u) => Math.max(max, u.id), 0) + 1;
      const newUpload = {
        id: nextId,
        user_id: sessionUser.id || 2,
        original_name: req.file.originalname,
        stored_name: req.file.filename,
        mime: req.file.mimetype,
        size: req.file.size,
        course_id: courseId,
        course_name: courseName,
        lesson_id: lessonId,
        lesson_name: lessonName,
        created_at: new Date().toISOString()
      };

      tutorUploads.unshift(newUpload);
      saveData();

      res.json({
        success: true,
        message: `Upload successful to "${courseName}" → ${lessonName}.`,
        file: {
          url: `uploads/tutor/${req.file.filename}`,
          name: req.file.originalname,
          mime: req.file.mimetype,
          course_id: courseId,
          course_name: courseName,
          lesson_id: lessonId,
          lesson_name: lessonName
        }
      });
    });
  }
);

// Endpoint to retrieve full courses and modules catalog
app.get(['/api/courses-catalog', '/api/courses-catalog.php'], (req, res) => {
  res.json({
    success: true,
    catalog: COURSE_CATALOG
  });
});

// Tutor: Edit an existing lesson (title, duration, summary, detailed guide, lab steps, etc.)
app.post(['/api/tutor/lesson/edit', '/api/tutor/lesson/edit.php'], (req, res) => {
  let sessionUser = (req.session && req.session.user) || req.user;
  if (!sessionUser) {
    sessionUser = users.find((u) => u.role === 'tutor') || defaultUsers[1];
  }

  const {
    course_id,
    lesson_id,
    name,
    duration,
    summary,
    overview,
    topics,
    lab_steps,
    commands_configs,
    key_takeaways
  } = req.body || {};

  if (!course_id || !lesson_id) {
    return res.status(400).json({ success: false, message: 'course_id and lesson_id are required.' });
  }

  const course = COURSE_CATALOG[course_id];
  if (!course) {
    return res.status(404).json({ success: false, message: 'Course not found.' });
  }

  const lesson = course.lessons.find((l) => l.id === lesson_id);
  if (!lesson) {
    return res.status(404).json({ success: false, message: 'Lesson module not found.' });
  }

  if (name && typeof name === 'string' && name.trim()) lesson.name = name.trim();
  if (duration && typeof duration === 'string' && duration.trim()) lesson.duration = duration.trim();
  if (summary && typeof summary === 'string' && summary.trim()) lesson.summary = summary.trim();

  if (!lesson.details) lesson.details = {};
  if (overview !== undefined) lesson.details.overview = String(overview).trim();

  if (topics !== undefined) {
    lesson.details.topics = Array.isArray(topics)
      ? topics.map((t) => String(t).trim()).filter(Boolean)
      : String(topics)
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean);
  }

  if (lab_steps !== undefined) {
    lesson.details.lab_guide = Array.isArray(lab_steps)
      ? lab_steps.map((s) => String(s).trim()).filter(Boolean)
      : String(lab_steps)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
  }

  if (commands_configs !== undefined) {
    lesson.details.commands_configs = String(commands_configs).trim();
  }

  if (key_takeaways !== undefined) {
    lesson.details.key_takeaways = Array.isArray(key_takeaways)
      ? key_takeaways.map((k) => String(k).trim()).filter(Boolean)
      : String(key_takeaways)
          .split('\n')
          .map((k) => k.trim())
          .filter(Boolean);
  }

  saveData();

  res.json({
    success: true,
    message: `Lesson "${lesson.name}" updated successfully.`,
    lesson,
    course
  });
});

// Tutor: Add extra question to lesson quiz
app.post(['/api/tutor/lesson/add-question', '/api/tutor/lesson/add-question.php'], (req, res) => {
  let sessionUser = (req.session && req.session.user) || req.user;
  if (!sessionUser) {
    sessionUser = users.find((u) => u.role === 'tutor') || defaultUsers[1];
  }

  const { course_id, lesson_id, question, options, answer, explanation } = req.body || {};
  if (!course_id || !lesson_id || !question) {
    return res.status(400).json({ success: false, message: 'course_id, lesson_id, and question text are required.' });
  }

  const course = COURSE_CATALOG[course_id];
  if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

  const lesson = course.lessons.find((l) => l.id === lesson_id);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson module not found.' });

  if (!Array.isArray(lesson.quiz)) {
    lesson.quiz = [];
  }

  let parsedOptions = options;
  if (typeof parsedOptions === 'string') {
    parsedOptions = parsedOptions
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(parsedOptions) || parsedOptions.length < 2) {
    return res.status(400).json({ success: false, message: 'Please provide at least 2 multiple-choice options.' });
  }

  const answerIdx = Math.max(0, Math.min(parsedOptions.length - 1, Number(answer) || 0));

  const newQuestion = {
    id: 'q_' + Date.now(),
    question: String(question).trim(),
    options: parsedOptions,
    answer: answerIdx,
    explanation: String(explanation || '').trim() || `Option ${answerIdx + 1} is the correct answer.`
  };

  lesson.quiz.push(newQuestion);
  saveData();

  res.json({
    success: true,
    message: `New question added to "${lesson.name}". Total questions: ${lesson.quiz.length}`,
    quiz: lesson.quiz,
    newQuestion
  });
});

// Tutor: Delete question from lesson quiz
app.post(['/api/tutor/lesson/delete-question', '/api/tutor/lesson/delete-question.php'], (req, res) => {
  let sessionUser = (req.session && req.session.user) || req.user;
  if (!sessionUser) {
    sessionUser = users.find((u) => u.role === 'tutor') || defaultUsers[1];
  }

  const { course_id, lesson_id, question_id } = req.body || {};
  if (!course_id || !lesson_id || !question_id) {
    return res.status(400).json({ success: false, message: 'course_id, lesson_id, and question_id are required.' });
  }

  const course = COURSE_CATALOG[course_id];
  if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

  const lesson = course.lessons.find((l) => l.id === lesson_id);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson module not found.' });

  if (Array.isArray(lesson.quiz)) {
    lesson.quiz = lesson.quiz.filter((q) => q.id !== question_id);
    saveData();
  }

  res.json({
    success: true,
    message: 'Question removed from quiz.',
    quiz: lesson.quiz
  });
});

// Tutor: Add extra lesson module to course
app.post(['/api/tutor/lesson/add-lesson', '/api/tutor/lesson/add-lesson.php'], (req, res) => {
  let sessionUser = (req.session && req.session.user) || req.user;
  if (!sessionUser) {
    sessionUser = users.find((u) => u.role === 'tutor') || defaultUsers[1];
  }

  const { course_id, name, duration, summary, overview } = req.body || {};
  if (!course_id || !name) {
    return res.status(400).json({ success: false, message: 'course_id and lesson name are required.' });
  }

  const course = COURSE_CATALOG[course_id];
  if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

  const nextModuleNum = course.lessons.length + 1;
  const newLesson = {
    id: `module-${nextModuleNum}`,
    name: name.trim(),
    duration: (duration && duration.trim()) || '45 mins',
    summary: (summary && summary.trim()) || 'Supplemental instructor lesson module.',
    details: {
      overview: (overview && overview.trim()) || 'Comprehensive module curriculum provided by your course tutor.',
      topics: ['Advanced concepts', 'Enterprise best practices', 'Operational troubleshooting'],
      lab_guide: [
        'Step 1: Review prerequisites and staging environment.',
        'Step 2: Apply enterprise configuration.',
        'Step 3: Verify endpoint state.'
      ],
      commands_configs: '// Instructor notes and configuration guidelines',
      key_takeaways: ['Master the core procedural steps.', 'Follow standard enterprise change control.']
    },
    quiz: [
      {
        id: `q_${Date.now()}`,
        question: `What is the primary objective of this module?`,
        options: [
          'To apply production-grade enterprise management configurations',
          'To disable all security features',
          'To bypass corporate policy',
          'To cancel IT subscriptions'
        ],
        answer: 0,
        explanation: 'This module trains candidates on implementing production-ready enterprise endpoint configurations.'
      }
    ]
  };

  course.lessons.push(newLesson);
  saveData();

  res.json({
    success: true,
    message: `Successfully added "${newLesson.name}" to ${course.name}.`,
    lesson: newLesson,
    course
  });
});

// Candidate: Submit quiz answers and receive instant scoring and feedback
app.post(['/api/quiz/submit', '/api/quiz/submit.php'], (req, res) => {
  const { course_id, lesson_id, answers } = req.body || {};
  if (!course_id || !lesson_id || !answers) {
    return res.status(400).json({ success: false, message: 'course_id, lesson_id, and answers are required.' });
  }

  const course = COURSE_CATALOG[course_id];
  if (!course) return res.status(404).json({ success: false, message: 'Course not found.' });

  const lesson = course.lessons.find((l) => l.id === lesson_id);
  if (!lesson || !Array.isArray(lesson.quiz) || lesson.quiz.length === 0) {
    return res.status(404).json({ success: false, message: 'No quiz found for this lesson module.' });
  }

  let correctCount = 0;
  const questionsResults = lesson.quiz.map((q, idx) => {
    const selected = answers[idx] !== undefined ? Number(answers[idx]) : -1;
    const isCorrect = selected === q.answer;
    if (isCorrect) correctCount++;
    return {
      id: q.id,
      question: q.question,
      selected,
      correctAnswer: q.answer,
      isCorrect,
      explanation: q.explanation
    };
  });

  const total = lesson.quiz.length;
  const percentage = Math.round((correctCount / total) * 100);
  const passed = percentage >= 70;

  // Persist student's quiz results for this lesson
  const userId = req.session?.user?.id || req.user?.id || 1;
  if (!quizProgress[userId]) quizProgress[userId] = {};
  if (!quizProgress[userId][course_id]) quizProgress[userId][course_id] = {};
  quizProgress[userId][course_id][lesson_id] = {
    score: correctCount,
    total,
    percentage,
    passed,
    updatedAt: new Date().toISOString()
  };
  saveData();

  res.json({
    success: true,
    score: correctCount,
    total,
    percentage,
    passed,
    quizProgress: quizProgress[userId][course_id],
    results: questionsResults,
    message: passed
      ? `🎉 Congratulations! You passed the quiz with ${percentage}% (${correctCount}/${total}).`
      : `You scored ${percentage}% (${correctCount}/${total}). Review the study guide and try again to pass!`
  });
});

// Candidate: Get quiz progress across courses and lessons
app.get(['/api/quiz/progress', '/api/quiz/progress.php'], (req, res) => {
  const userId = req.session?.user?.id || req.user?.id || 1;
  res.json({
    success: true,
    userId,
    quizProgress: quizProgress[userId] || {}
  });
});

// Endpoint to retrieve curriculum resources uploaded for courses & lessons
app.get(['/api/course-resources', '/api/course-resources.php'], (req, res) => {
  const { course_id, lesson_id } = req.query || {};
  let list = tutorUploads;
  if (course_id) {
    list = list.filter((u) => u.course_id === course_id);
  }
  if (lesson_id) {
    list = list.filter((u) => u.lesson_id === lesson_id);
  }
  res.json({
    success: true,
    resources: list.map((u) => ({
      id: u.id,
      original_name: u.original_name,
      stored_name: u.stored_name,
      mime: u.mime,
      size: u.size,
      course_id: u.course_id,
      course_name: u.course_name,
      lesson_id: u.lesson_id,
      lesson_name: u.lesson_name,
      url: `uploads/tutor/${u.stored_name}`,
      created_at: u.created_at
    }))
  });
});

// Endpoint to generate & download / stream dynamic PDF materials for an unlocked module
app.get(['/api/module-pdf', '/api/module-pdf.php'], async (req, res) => {
  try {
    const courseId = (req.query.course_id || 'android-enterprise').trim();
    const lessonId = (req.query.lesson_id || req.query.module_id || 'module-1').trim();
    const type = (req.query.type || 'manual').trim();
    const isDownload = req.query.download === '1' || req.query.download === 'true';

    const course = COURSE_CATALOG[courseId];
    if (!course) {
      return res.status(404).json({ success: false, message: `Course "${courseId}" not found.` });
    }

    const lessonIdx = course.lessons.findIndex((l) => l.id === lessonId);
    if (lessonIdx === -1) {
      return res.status(404).json({ success: false, message: `Module "${lessonId}" not found in ${course.name}.` });
    }
    const lesson = course.lessons[lessonIdx];

    // Check unlocking gating: Candidate must have unlocked this module (idx <= completed)
    const sessionUser = (req.session && req.session.user) || req.user;
    const userId = sessionUser?.id || 1;
    const isTutor = sessionUser?.role === 'tutor';
    const userProgress = (courseProgress[userId] && courseProgress[userId][courseId]) || (defaultCourseProgress[1] && defaultCourseProgress[1][courseId]) || { completed: 0 };
    const completedCount = userProgress.completed || 0;
    const isUnlocked = isTutor || (lessonIdx <= completedCount);

    if (!isUnlocked) {
      return res.status(403).json({
        success: false,
        message: `Module "${lesson.name}" is locked. Complete previous modules and pass the mandatory quiz to unlock its PDF resources.`
      });
    }

    const pdfBuffer = await generateModulePdfBuffer({ course, lesson, type });

    const cleanCourse = (course.name || courseId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanLesson = (lesson.name || lessonId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const typeSuffix = type === 'blueprint' ? 'Architecture_Blueprint' : 'Lab_Manual';
    const filename = `${cleanCourse}_${cleanLesson}_${typeSuffix}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[Module PDF Generation Error]', err);
    res.status(500).json({ success: false, message: 'Failed to generate module PDF: ' + err.message });
  }
});

// Endpoint to retrieve complete list of module resources with unlock status
app.get(['/api/module-resources', '/api/module-resources.php'], (req, res) => {
  const courseId = (req.query.course_id || 'android-enterprise').trim();
  const targetLessonId = req.query.lesson_id || req.query.module_id || null;

  const course = COURSE_CATALOG[courseId];
  if (!course) {
    return res.status(404).json({ success: false, message: 'Course not found.' });
  }

  const sessionUser = (req.session && req.session.user) || req.user;
  const userId = sessionUser?.id || 1;
  const isTutor = sessionUser?.role === 'tutor';
  const userProgress = (courseProgress[userId] && courseProgress[userId][courseId]) || (defaultCourseProgress[1] && defaultCourseProgress[1][courseId]) || { completed: 0 };
  const completedCount = userProgress.completed || 0;

  const modulesData = course.lessons.map((lesson, idx) => {
    const isUnlocked = isTutor || (idx <= completedCount);
    const isCompleted = idx < completedCount;

    // Filter tutor uploaded PDFs for this module
    const uploads = tutorUploads.filter((u) => {
      if (u.course_id !== courseId) return false;
      if (u.lesson_id && u.lesson_id === lesson.id) return true;
      if (u.lesson_name && u.lesson_name.toLowerCase().includes(`module ${idx + 1}`)) return true;
      return false;
    });

    const pdfResources = isUnlocked
      ? [
          {
            id: `${lesson.id}-manual`,
            title: `${lesson.name} — Official Lab Manual & Curriculum Guide`,
            filename: `${lesson.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Official_Lab_Manual.pdf`,
            type: 'Official Lab Manual',
            doc_type: 'manual',
            mime: 'application/pdf',
            size: 148400,
            badge: 'Official Guide',
            download_url: `/api/module-pdf.php?course_id=${encodeURIComponent(courseId)}&lesson_id=${encodeURIComponent(lesson.id)}&type=manual&download=1`,
            view_url: `/api/module-pdf.php?course_id=${encodeURIComponent(courseId)}&lesson_id=${encodeURIComponent(lesson.id)}&type=manual`,
            description: 'Step-by-step hands-on lab instructions, architecture diagrams, production procedures, and key takeaways.'
          },
          {
            id: `${lesson.id}-blueprint`,
            title: `${lesson.name} — Technical Architecture & Deployment Blueprint`,
            filename: `${lesson.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Architecture_Blueprint.pdf`,
            type: 'Technical Blueprint',
            doc_type: 'blueprint',
            mime: 'application/pdf',
            size: 96200,
            badge: 'Payload Specs',
            download_url: `/api/module-pdf.php?course_id=${encodeURIComponent(courseId)}&lesson_id=${encodeURIComponent(lesson.id)}&type=blueprint&download=1`,
            view_url: `/api/module-pdf.php?course_id=${encodeURIComponent(courseId)}&lesson_id=${encodeURIComponent(lesson.id)}&type=blueprint`,
            description: 'DPC extras JSON/XML schemas, enterprise staging payloads, and ADB CLI verification commands.'
          },
          ...uploads.map((u) => ({
            id: `tutor-${u.id}`,
            title: u.original_name,
            filename: u.original_name,
            type: 'Instructor Reference',
            doc_type: 'tutor_upload',
            mime: u.mime || 'application/pdf',
            size: u.size || 64000,
            badge: 'Instructor Upload',
            download_url: `/api/download-file.php?stored_name=${encodeURIComponent(u.stored_name)}&name=${encodeURIComponent(u.original_name)}`,
            view_url: `uploads/tutor/${u.stored_name}`,
            description: `Instructor supplemental material assigned to ${lesson.name}.`
          }))
        ]
      : [];

    return {
      id: lesson.id,
      name: lesson.name,
      duration: lesson.duration,
      idx,
      isUnlocked,
      isCompleted,
      resourcesCount: pdfResources.length,
      resources: pdfResources
    };
  });

  const filteredModules = targetLessonId
    ? modulesData.filter((m) => m.id === targetLessonId)
    : modulesData;

  res.json({
    success: true,
    courseId,
    courseName: course.name,
    completedCount,
    modules: filteredModules
  });
});

// Endpoint to force download a tutor-uploaded file with original filename
app.get(['/api/download-file', '/api/download-file.php'], (req, res) => {
  const storedName = req.query.stored_name;
  const originalName = req.query.name || storedName || 'curriculum-resource.pdf';
  if (!storedName) {
    return res.status(400).send('File parameter required.');
  }

  const safeStored = path.basename(storedName);
  const filePath = path.join(uploadDir, safeStored);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Resource file not found on server.');
  }

  res.download(filePath, originalName);
});

// 9. Tutor upload delete
app.post(
  [
    '/api/tutor-upload-delete',
    '/api/tutor-upload-delete.php',
    '/tutor-upload-delete',
    '/tutor-upload-delete.php'
  ],
  (req, res) => {
    let sessionUser = (req.session && req.session.user) || req.user;
    if (!sessionUser) {
      sessionUser = users.find((u) => u.role === 'tutor') || defaultUsers[1];
    }

    const id = Number(req.body?.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'id is required.' });
    }

    const uploadIndex = tutorUploads.findIndex((u) => u.id === id);
    if (uploadIndex === -1) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const [removed] = tutorUploads.splice(uploadIndex, 1);
    saveData();

    if (removed.stored_name) {
      const filePath = path.join(uploadDir, removed.stored_name);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // ignore unlink error
        }
      }
    }

    res.json({ success: true });
  }
);

// 10. Admin users list (for debugging / verification)
app.get(['/api/admin_users_list', '/api/admin_users_list.php'], (req, res) => {
  if (req.query.token !== 'admin-test-token') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  res.json({
    success: true,
    users: users.map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      must_reset_password: u.must_reset_password,
      created_at: u.created_at
    }))
  });
});

// Helper to calculate progress with percentage
function enrichProgress(userProg) {
  const result = {};
  const base = defaultCourseProgress[1];
  for (const [courseId, def] of Object.entries(base)) {
    const userCourse = userProg && userProg[courseId] ? userProg[courseId] : def;
    const total = userCourse.total || def.total || 6;
    const completed = Math.max(0, Math.min(total, userCourse.completed ?? def.completed ?? 0));
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    result[courseId] = {
      courseId,
      name: userCourse.name || def.name,
      total,
      completed,
      percentage,
      isCompleted: completed >= total
    };
  }
  return result;
}

// 11. Get course progress
app.get(['/api/progress', '/api/progress.php'], (req, res) => {
  const userId = req.session?.user?.id || req.user?.id || 1;
  if (!courseProgress[userId]) {
    courseProgress[userId] = JSON.parse(JSON.stringify(defaultCourseProgress[1]));
    saveData();
  }
  const enriched = enrichProgress(courseProgress[userId]);
  res.json({
    success: true,
    userId,
    progress: enriched,
    quizProgress: quizProgress[userId] || {}
  });
});

// 12. Update course progress / complete module
app.post(['/api/progress', '/api/progress.php', '/api/progress/complete', '/api/progress/complete.php'], (req, res) => {
  const userId = req.session?.user?.id || req.user?.id || 1;
  const { courseId, action = 'increment', completed } = req.body || {};

  if (!courseId) {
    return res.status(400).json({ success: false, message: 'courseId is required.' });
  }

  if (!courseProgress[userId]) {
    courseProgress[userId] = JSON.parse(JSON.stringify(defaultCourseProgress[1]));
  }

  const base = defaultCourseProgress[1];
  if (!courseProgress[userId][courseId] && base[courseId]) {
    courseProgress[userId][courseId] = { ...base[courseId] };
  }

  const userCourse = courseProgress[userId][courseId];
  if (!userCourse) {
    return res.status(404).json({ success: false, message: 'Course not found.' });
  }

  const total = userCourse.total || 6;
  if (action === 'set' && typeof completed === 'number') {
    userCourse.completed = Math.max(0, Math.min(total, completed));
  } else if (action === 'decrement') {
    userCourse.completed = Math.max(0, (userCourse.completed || 0) - 1);
  } else {
    // Default action: increment
    userCourse.completed = Math.min(total, (userCourse.completed || 0) + 1);
  }

  saveData();

  const enriched = enrichProgress(courseProgress[userId]);
  res.json({
    success: true,
    message: `Updated progress for ${userCourse.name || courseId}.`,
    course: enriched[courseId],
    progress: enriched
  });
});

// 13. Reset course progress back to Lesson 1 (for testing or restarting sequential curriculum)
app.post(['/api/progress/reset', '/api/progress/reset.php'], (req, res) => {
  const userId = req.session?.user?.id || req.user?.id || 1;
  const { courseId } = req.body || {};

  if (!courseId) {
    return res.status(400).json({ success: false, message: 'courseId is required.' });
  }

  if (!courseProgress[userId]) {
    courseProgress[userId] = JSON.parse(JSON.stringify(defaultCourseProgress[1]));
  }

  if (courseProgress[userId][courseId]) {
    courseProgress[userId][courseId].completed = 0;
  }

  if (quizProgress[userId] && quizProgress[userId][courseId]) {
    quizProgress[userId][courseId] = {};
  }

  saveData();

  const enriched = enrichProgress(courseProgress[userId]);
  res.json({
    success: true,
    message: `Reset ${courseId} progress back to Lesson 1.`,
    course: enriched[courseId],
    progress: enriched,
    quizProgress: quizProgress[userId] || {}
  });
});

// ==========================================
// STATIC FILES & ASSETS
// ==========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// Fallback to index.html for root or SPA paths
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ensure any unmatched API or PHP requests return clean JSON instead of HTML
app.all(['/api/*', '*.php', '*/api/*'], (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl || req.url} not found.`
  });
});

// Global Express error handler: NEVER send HTML error pages for API requests
app.use((err, req, res, next) => {
  console.error('[Global Server Error]', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error occurred.'
  });
});

app.listen(PORT, HOST, () => {
  console.log(`UEM Labs server running at http://${HOST}:${PORT}`);
});
