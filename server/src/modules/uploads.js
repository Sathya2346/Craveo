import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { ApiError } from '../utils/ApiError.js';

export const uploadRouter = Router();

// Any signed-in user can upload (profile pictures); catalog images are attached
// through the admin-only content endpoints.
uploadRouter.post('/image', requireAuth, (req, res, next) => {
  imageUpload(req, res, (error) => {
    if (error) return next(error);
    if (!req.file) return next(new ApiError(400, 'Please choose an image to upload', { code: 'NO_FILE' }));

    const relative = `/uploads/${req.file.filename}`;
    return res.status(201).json({
      success: true,
      data: {
        url: relative,
        absoluteUrl: `${req.protocol}://${req.get('host')}${relative}`,
        fileName: req.file.filename,
        size: req.file.size,
      },
      message: 'Image uploaded',
    });
  });
});
