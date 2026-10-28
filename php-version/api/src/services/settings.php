<?php

declare(strict_types=1);

/** Every key here is editable from the admin panel and returned to the client. */
const CRAVEO_DEFAULT_SETTINGS = [
    'site_name' => 'Craveo',
    'tagline' => 'Cravings delivered in 30 minutes',
    'announcement' => 'Free delivery above ₹499 · Use CRAVE20 for 20% off your first order',
    'support_phone' => '+91 90000 12345',
    'support_email' => 'hello@craveo.app',
    'company_address' => '42 Anna Salai, Chennai 600002',
    'opening_hours' => '10:00 AM - 11:00 PM',
    'currency' => 'INR',
    'currency_symbol' => '₹',
    'delivery_fee' => '30',
    'free_delivery_above' => '499',
    'min_order_value' => '99',
    'tax_percent' => '5',
    'delivery_radius_km' => '8',
    'instagram_url' => 'https://instagram.com/craveo',
    'facebook_url' => 'https://facebook.com/craveo',
    'twitter_url' => 'https://x.com/craveo',
    'youtube_url' => '',
    'app_android_url' => '',
    'app_ios_url' => '',
];

function setting_keys(): array
{
    return array_keys(CRAVEO_DEFAULT_SETTINGS);
}

function get_settings(): array
{
    $rows = Db::q('SELECT setting_key, setting_value FROM settings');
    $stored = [];
    foreach ($rows as $row) {
        $stored[$row['setting_key']] = $row['setting_value'];
    }

    return array_merge(CRAVEO_DEFAULT_SETTINGS, $stored);
}

function get_numeric_setting(string $key, float $fallback = 0): float
{
    $settings = get_settings();
    $value = $settings[$key] ?? null;
    return is_numeric($value) ? (float) $value : $fallback;
}

/**
 * Money rules used by both the quote endpoint and order placement.
 * Identical maths to the Node service: delivery is free above the threshold,
 * tax applies to (subtotal - discount), totals are rounded to 2 decimals.
 */
function build_pricing(float $subtotal, array $restaurant, array $settings, float $discount = 0): array
{
    $taxPercent = (float) ($settings['tax_percent'] ?? 0);
    $freeDeliveryAbove = money($settings['free_delivery_above'] ?? 0);
    $restaurantFee = money($restaurant['delivery_fee'] ?? ($settings['delivery_fee'] ?? 0));
    $deliveryFee = $subtotal >= $freeDeliveryAbove ? 0.0 : $restaurantFee;
    $taxable = max(0, money($subtotal) - money($discount));
    $tax = round2(($taxable * $taxPercent) / 100);
    $total = round2($taxable + $deliveryFee + $tax);

    return [
        'subtotal' => money($subtotal),
        'discount' => money($discount),
        'deliveryFee' => $deliveryFee,
        'tax' => $tax,
        'total' => $total,
        'taxPercent' => $taxPercent,
    ];
}
