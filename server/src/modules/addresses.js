import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, badRequest, notFound } from '../utils/ApiError.js';
import { mapAddress } from './mappers.js';

export const addressRouter = Router();
addressRouter.use(requireAuth);

const MAX_ADDRESSES = 10;

const addressSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(40).default('Home'),
  contactName: z.string().trim().min(2, 'Name is required').max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{6,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(5, 'Address is too short').max(255),
  line2: z.string().trim().max(255).optional().or(z.literal('').transform(() => null)),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().max(80).optional().or(z.literal('').transform(() => null)),
  pincode: z.string().trim().regex(/^[0-9]{5,6}$/, 'Enter a valid 6 digit pincode'),
  isDefault: z.boolean().optional().default(false),
});

addressRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await query(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC',
      [req.user.id],
    );
    res.json({ success: true, data: rows.map(mapAddress) });
  }),
);

addressRouter.post(
  '/',
  validate({ body: addressSchema }),
  asyncHandler(async (req, res) => {
    const count = await queryOne('SELECT COUNT(*) AS total FROM addresses WHERE user_id = ?', [
      req.user.id,
    ]);
    if (Number(count.total) >= MAX_ADDRESSES) {
      throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses. Delete one first.`);
    }

    const data = req.data.body;
    const isFirst = Number(count.total) === 0;
    const shouldDefault = data.isDefault || isFirst;

    if (shouldDefault) {
      await execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    const result = await execute(
      `INSERT INTO addresses (user_id, label, contact_name, phone, line1, line2, city, state, pincode, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        data.label,
        data.contactName,
        data.phone,
        data.line1,
        data.line2 ?? null,
        data.city,
        data.state ?? null,
        data.pincode,
        shouldDefault ? 1 : 0,
      ],
    );

    const row = await queryOne('SELECT * FROM addresses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: mapAddress(row), message: 'Address saved' });
  }),
);

addressRouter.patch(
  '/:id',
  validate({ body: addressSchema.partial() }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound('Address not found');

    const existing = await queryOne('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Address not found');

    const data = req.data.body;
    const columns = {
      label: data.label,
      contact_name: data.contactName,
      phone: data.phone,
      line1: data.line1,
      line2: data.line2,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
    };

    const updates = Object.entries(columns).filter(([, value]) => value !== undefined);
    if (!updates.length && data.isDefault === undefined) throw badRequest('Nothing to update');

    if (data.isDefault) {
      await execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    if (updates.length) {
      const values = updates.map(([, value]) => (value === '' ? null : value));
      const assignments = updates.map(([column]) => `${column} = ?`);
      await execute(`UPDATE addresses SET ${assignments.join(', ')} WHERE id = ? AND user_id = ?`, [
        ...values,
        id,
        req.user.id,
      ]);
    }

    if (data.isDefault !== undefined) {
      await execute('UPDATE addresses SET is_default = ? WHERE id = ? AND user_id = ?', [
        data.isDefault ? 1 : 0,
        id,
        req.user.id,
      ]);
    }

    const row = await queryOne('SELECT * FROM addresses WHERE id = ?', [id]);
    res.json({ success: true, data: mapAddress(row), message: 'Address updated' });
  }),
);

addressRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw notFound('Address not found');

    const existing = await queryOne('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);
    if (!existing) throw notFound('Address not found');

    await execute('DELETE FROM addresses WHERE id = ? AND user_id = ?', [id, req.user.id]);

    if (existing.is_default) {
      const next = await queryOne(
        'SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        [req.user.id],
      );
      if (next) await execute('UPDATE addresses SET is_default = 1 WHERE id = ?', [next.id]);
    }

    res.json({ success: true, message: 'Address removed' });
  }),
);
