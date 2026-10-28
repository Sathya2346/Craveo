import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

fs.mkdirSync(env.uploadsDir, { recursive: true });

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) || path.extname(file.originalname).toLowerCase();
    const stamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    cb(null, `${stamp}-${random}${ext}`);
  },
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new ApiError(400, 'Only JPG, PNG, WEBP or GIF images are allowed', {
        code: 'INVALID_FILE_TYPE',
      }));
    }
    return cb(null, true);
  },
}).single('image');
