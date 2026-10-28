import { Router } from 'express';
import { z } from 'zod';
import { execute, query, queryOne } from '../../config/db.js';
import { requireAdmin, requireStaff } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, badRequest, conflict, notFound } from '../../utils/ApiError.js';
import { paginate, paginationMeta } from '../../utils/helpers.js';
import { DEFAULT_SETTINGS, getSettings, SETTING_KEYS } from '../../services/settings.js';
import { mapBanner, mapCoupon } from '../mappers.js';

export const adminMarketingRouter = Router();

/* --------------------------------- banners --------------------------------- */

const bannerBody = z.object({
  title: z.string().trim().min(2, 'Title is required').max(120),
  subtitle: z.string().trim().max(255).optional().or(z.literal('').transform(() => null)),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === '' || value.startsWith('/') || /^https?:\/\//i.test(value), {
      message: 'Enter a valid image URL',
    })
    .optional()
    .or(z.literal('').transform(() => null)),
  ctaLabel: z.string().trim().max(40).optional().or(z.literal('').transform(() => null)),
  ctaLink: z.string().trim().max(255).optional().or(z.literal('').transform(() => null)),
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #ff5a1f')
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

const BANNER_COLUMNS = {
  title: 'title',
  subtitle: 'subtitle',
  imageUrl: 'image_url',
  ctaLabel: 'cta_label',
  ctaLink: 'cta_link',
  accent: 'accent',
  sortOrder: 'sort_order',
  isActive: 'is_active',
};

const toColumns = (payload, map) => {
  const data = {};
  for (const [key, column] of Object.entries(map)) {
    if (payload[key] === undefined) continue;
    const value = payload[key];
    data[column] = typeof value === 'boolean' ? (value ? 1 : 0) : value === '' ? null : value;
  }
  return data;
};

adminMarketingRouter.get(
  '/banners',
  requireStaff,
  asyncHandler(async (_req, res) => {
    const rows = await query('SELECT * FROM banners ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: rows.map(mapBanner) });
  }),
);

adminMarketingRouter.post(
  '/banners',
  requireStaff,
  validate({ body: bannerBody }),
  asyncHandler(async (req, res) => {
    const data = toColumns(req.data.body, BANNER_COLUMNS);
    const columns = Object.keys(data);
    const result = await execute(
      `INSERT INTO banners (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      Object.values(data),
    );
    const row = await queryOne('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: mapBanner(row), message: 'Banner added' });
  }),
);

adminMarketingRouter.patch(
  '/banners/:id',
  requireStaff,
  validate({ body: bannerBody.partial() }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const data = toColumns(req.data.body, BANNER_COLUMNS);
    const columns = Object.keys(data);
    if (!columns.length) throw badRequest('Nothing to update');

    const result = await execute(
      `UPDATE banners SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((column) => data[column]), id],
    );
    if (result.affectedRows === 0) throw notFound('Banner not found');

    const row = await queryOne('SELECT * FROM banners WHERE id = ?', [id]);
    res.json({ success: true, data: mapBanner(row), message: 'Banner updated' });
  }),
);

adminMarketingRouter.delete(
  '/banners/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
    const result = await execute('DELETE FROM banners WHERE id = ?', [Number(req.params.id)]);
    if (result.affectedRows === 0) throw notFound('Banner not found');
    res.json({ success: true, message: 'Banner deleted' });
  }),
);

/* --------------------------------- coupons --------------------------------- */

const couponBase = z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'Code must be at least 3 characters')
      .max(30)
      .regex(/^[A-Z0-9_-]+$/, 'Use letters, numbers, - or _ only'),
    description: z.string().trim().max(255).optional().or(z.literal('').transform(() => null)),
    discountType: z.enum(['PERCENT', 'FLAT']).default('PERCENT'),
    discountValue: z.coerce.number().positive('Discount must be greater than 0').max(100_000),
    minOrderValue: z.coerce.number().min(0).max(100_000).optional(),
    maxDiscount: z.coerce.number().min(0).max(100_000).nullable().optional(),
    usageLimit: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
    perUserLimit: z.coerce.number().int().min(1).max(100).optional(),
    startsAt: z.string().trim().datetime({ offset: true }).nullable().optional()
      .or(z.literal('').transform(() => null)),
    expiresAt: z.string().trim().datetime({ offset: true }).nullable().optional()
      .or(z.literal('').transform(() => null)),
    isActive: z.boolean().optional(),
  });

const couponBody = couponBase.superRefine((value, ctx) => {
    if (value.discountType === 'PERCENT' && value.discountValue > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100',
      });
    }
    if (value.startsAt && value.expiresAt && new Date(value.startsAt) >= new Date(value.expiresAt)) {
      ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'End date must be after start date' });
    }
  });

const COUPON_COLUMNS = {
  code: 'code',
  description: 'description',
  discountType: 'discount_type',
  discountValue: 'discount_value',
  minOrderValue: 'min_order_value',
  maxDiscount: 'max_discount',
  usageLimit: 'usage_limit',
  perUserLimit: 'per_user_limit',
  startsAt: 'starts_at',
  expiresAt: 'expires_at',
  isActive: 'is_active',
};

const toMysqlDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

adminMarketingRouter.get(
  '/coupons',
  requireStaff,
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      limit: z.coerce.number().int().min(1).max(60).default(20),
      search: z.string().trim().max(40).optional(),
      status: z.enum(['all', 'active', 'inactive']).default('all'),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, limit, search, status } = req.data.query;
    const { offset } = paginate(page, limit);

    const where = ['1 = 1'];
    const params = [];
    if (search) {
      where.push('code LIKE ?');
      params.push(`%${search.toUpperCase()}%`);
    }
    if (status !== 'all') {
      where.push('is_active = ?');
      params.push(status === 'active' ? 1 : 0);
    }
    const whereSql = where.join(' AND ');

    const [rows, totalRow] = await Promise.all([
      query(`SELECT * FROM coupons WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`, [
        ...params,
        limit,
        offset,
      ]),
      queryOne(`SELECT COUNT(*) AS total FROM coupons WHERE ${whereSql}`, params),
    ]);

    res.json({
      success: true,
      data: rows.map(mapCoupon),
      meta: paginationMeta(totalRow.total, page, limit),
    });
  }),
);

adminMarketingRouter.post(
  '/coupons',
  requireStaff,
  validate({ body: couponBody }),
  asyncHandler(async (req, res) => {
    const payload = req.data.body;
    const data = toColumns(payload, COUPON_COLUMNS);
    data.starts_at = toMysqlDate(payload.startsAt);
    data.expires_at = toMysqlDate(payload.expiresAt);

    const existing = await queryOne('SELECT id FROM coupons WHERE code = ?', [payload.code]);
    if (existing) throw conflict('A coupon with this code already exists', { field: 'code' });

    const columns = Object.keys(data);
    const result = await execute(
      `INSERT INTO coupons (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      Object.values(data),
    );
    const row = await queryOne('SELECT * FROM coupons WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: mapCoupon(row), message: 'Coupon created' });
  }),
);

adminMarketingRouter.patch(
  '/coupons/:id',
  requireStaff,
  validate({ body: couponBase.partial() }),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await queryOne('SELECT * FROM coupons WHERE id = ?', [id]);
    if (!existing) throw notFound('Coupon not found');

    const payload = req.data.body;
    const data = toColumns(payload, COUPON_COLUMNS);
    if (payload.startsAt !== undefined) data.starts_at = toMysqlDate(payload.startsAt);
    if (payload.expiresAt !== undefined) data.expires_at = toMysqlDate(payload.expiresAt);

    if (payload.code && payload.code !== existing.code) {
      const clash = await queryOne('SELECT id FROM coupons WHERE code = ? AND id <> ?', [payload.code, id]);
      if (clash) throw conflict('A coupon with this code already exists', { field: 'code' });
    }

    const nextType = payload.discountType ?? existing.discount_type;
    const nextValue = Number(payload.discountValue ?? existing.discount_value);
    if (nextType === 'PERCENT' && nextValue > 100) {
      throw badRequest('Percentage discount cannot exceed 100', [{ field: 'discountValue' }]);
    }

    const nextStarts = payload.startsAt !== undefined ? payload.startsAt : existing.starts_at;
    const nextExpires = payload.expiresAt !== undefined ? payload.expiresAt : existing.expires_at;
    if (nextStarts && nextExpires && new Date(nextStarts) >= new Date(nextExpires)) {
      throw badRequest('End date must be after start date', [{ field: 'expiresAt' }]);
    }

    const columns = Object.keys(data);
    if (!columns.length) throw badRequest('Nothing to update');

    await execute(
      `UPDATE coupons SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((column) => data[column]), id],
    );

    const row = await queryOne('SELECT * FROM coupons WHERE id = ?', [id]);
    res.json({ success: true, data: mapCoupon(row), message: 'Coupon updated' });
  }),
);

adminMarketingRouter.delete(
  '/coupons/:id',
  requireStaff,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await queryOne('SELECT id FROM coupons WHERE id = ?', [id]);
    if (!existing) throw notFound('Coupon not found');

    const used = await queryOne('SELECT COUNT(*) AS total FROM orders WHERE coupon_id = ?', [id]);
    if (Number(used.total) > 0) {
      throw conflict(
        `This coupon was used in ${used.total} order(s). Deactivate it instead of deleting it.`,
      );
    }

    await execute('DELETE FROM coupons WHERE id = ?', [id]);
    res.json({ success: true, message: 'Coupon deleted' });
  }),
);

/* --------------------------------- settings -------------------------------- */

adminMarketingRouter.get(
  '/settings',
  requireStaff,
  asyncHandler(async (_req, res) => {
    const settings = await getSettings();
    res.json({ success: true, data: settings, meta: { editableKeys: SETTING_KEYS } });
  }),
);

adminMarketingRouter.put(
  '/settings',
  requireAdmin,
  validate({
    body: z.object({
      values: z.record(z.string().max(2000)).refine(
        (values) => Object.keys(values).every((key) => SETTING_KEYS.includes(key)),
        { message: 'One of the settings keys is not editable' },
      ),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { values } = req.data.body;
    const entries = Object.entries(values);
    if (!entries.length) throw badRequest('Nothing to save');

    for (const [key, value] of entries) {
      await execute(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, String(value ?? '')],
      );
    }

    const settings = await getSettings();
    res.json({ success: true, data: settings, message: 'Settings saved' });
  }),
);

adminMarketingRouter.post(
  '/settings/reset',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await execute(
        `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, value],
      );
    }
    res.json({ success: true, data: await getSettings(), message: 'Settings restored to defaults' });
  }),
);
