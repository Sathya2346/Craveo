/**
 * Craveo UI smoke check.
 *
 * Requires the API (http://localhost:5000) and Vite (http://localhost:5173) to
 * be running. Drives the real app in headless Chrome, asserts rendered DOM and
 * fails on any console error or uncaught page error.
 *
 * Usage: node ui-check.mjs
 */
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.APP_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:5000';

const failures = [];
const checks = [];
const consoleErrors = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const record = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const attachLogging = (page, label) => {
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('favicon') || text.includes('Download the React DevTools')) return;
    consoleErrors.push(`[${label}] console: ${text}`);
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(`[${label}] pageerror: ${error.message}`);
  });
};

const goto = async (page, path, waitFor) => {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 45000 });
  if (waitFor) {
    await page.waitForFunction((text) => document.body.innerText.includes(text), { timeout: 20000 }, waitFor);
  }
};

const text = (page) => page.evaluate(() => document.body.innerText);

const count = (page, selector) => page.$$eval(selector, (nodes) => nodes.length);

const hasHorizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
});

try {
  /* ------------------------------ storefront ----------------------------- */
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  attachLogging(page, 'storefront');
  await page.setViewport({ width: 1440, height: 900 });

  await goto(page, '/', 'Your cravings');
  const home = await text(page);
  record('home renders hero + announcement', home.includes('delivered') && home.includes('Search'));
  const homeCards = await count(page, '.food-card');
  record('home fetches dishes from the API', homeCards >= 6, `${homeCards} food cards`);
  const homeRestaurants = await count(page, '.rest-card');
  record('home fetches featured restaurants', homeRestaurants >= 3, `${homeRestaurants} restaurants`);
  record('home has no horizontal overflow', !(await hasHorizontalOverflow(page)));

  await goto(page, '/foods', 'Explore the menu');
  const foodCards = await count(page, '.food-card');
  record('menu page renders the full catalog', foodCards >= 10, `${foodCards} dishes`);

  await goto(page, '/restaurants', 'Restaurants near you');
  record('restaurant listing renders', (await count(page, '.rest-card')) >= 5);

  await goto(page, '/restaurant/dindigul-thalappakatti', 'Dindigul Thalappakatti');
  record('restaurant menu page renders dishes', (await count(page, '.menu-item')) >= 4);

  await goto(page, '/food/1', 'Chicken Biryani');
  const detail = await text(page);
  record('dish detail shows price and add button', detail.includes('Add') && detail.includes('₹'));

  await goto(page, '/offers', 'Offers worth a click');
  record('offers page lists coupons', (await text(page)).includes('CRAV') || (await text(page)).includes('FLAT'));

  /* ------------------------------- add to cart --------------------------- */
  await goto(page, '/foods', 'Explore the menu');
  await page.click('.food-card .add-btn');
  await page.waitForSelector('.toast--success', { timeout: 10000 });
  const badge = await page.$eval('.cart-btn__badge', (node) => node.textContent).catch(() => null);
  record('adding a dish updates the cart badge', badge === '1', `badge=${badge}`);

  await page.click('.cart-btn');
  await page.waitForSelector('.drawer', { timeout: 10000 });
  await sleep(700); // let the spring animation settle before asserting/clicking
  record('cart drawer opens with the added line', (await count(page, '.drawer .cart-line')) >= 1);
  await page.evaluate(() => document.querySelector('.drawer__head .icon-btn')?.click());
  await page.waitForSelector('.drawer', { hidden: true, timeout: 10000 });

  /* -------------------------------- checkout ----------------------------- */
  await goto(page, '/login', 'Welcome back');
  await page.type('input[type=email]', 'priya@example.com');
  await page.type('input[type=password]', 'Customer@123');
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }), page.click('button[type=submit]')]);
  record('customer can sign in through the UI', (await count(page, '.avatar')) >= 1);

  await page.evaluate(() => localStorage.setItem('craveo:cart', JSON.stringify({ lines: [], restaurant: null, couponCode: '' })));
  await goto(page, '/foods', 'Explore the menu');
  // Pick a dish that clears its restaurant's minimum order so checkout is enabled.
  const picked = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.food-card')];
    const card = cards.find((node) => node.innerText.toLowerCase().includes('chicken biryani')) || cards[0];
    card.querySelector('.add-btn').click();
    return card.innerText.split('\n')[0];
  });
  record('checkout test picks a valid dish', Boolean(picked), picked);
  await page.waitForSelector('.toast--success', { timeout: 10000 });

  await goto(page, '/cart', 'Your cart');
  // Give the server quote time to land before checking the CTA state.
  await sleep(1200);
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((button) => button.textContent.includes('Proceed to checkout') && !button.disabled),
    { timeout: 20000 },
  );
  await page.click('button::-p-text(Proceed to checkout)').catch(async () => {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent.includes('Proceed to checkout'));
      button?.click();
    });
  });
  await page.waitForFunction(() => location.pathname === '/checkout', { timeout: 20000 });

  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((button) => button.textContent.includes('Place order') && !button.disabled),
    { timeout: 20000 },
  );
  const orderResponses = [];
  page.on('response', async (response) => {
    if (!response.url().endsWith('/api/orders') || response.request().method() !== 'POST') return;
    let body = '';
    try {
      body = await response.text();
    } catch {
      body = '<unreadable>';
    }
    orderResponses.push(`${response.status()} ${body.slice(0, 240)}`);
  });

  // The CTA enables only once addresses are loaded; click and retry once if the
  // button happens to be re-rendered mid-click.
  const clickPlaceOrder = () =>
    page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent.includes('Place order'));
      if (!button) return 'missing';
      if (button.disabled) return 'disabled';
      button.click();
      return 'clicked';
    });

  await sleep(400);
  let clickResult = await clickPlaceOrder();
  if (clickResult !== 'clicked') {
    await sleep(1500);
    clickResult = await clickPlaceOrder();
  }

  try {
    await page.waitForFunction(() => location.pathname.startsWith('/order-success/'), { timeout: 25000 });
  } catch {
    const banner = await page.$eval('.error-banner', (node) => node.textContent).catch(() => '(no banner)');
    const toast = await page.$eval('.toast', (node) => node.textContent).catch(() => '(no toast)');
    record(
      'order placement failed',
      false,
      `click=${clickResult} banner=${banner} toast=${toast} responses=${orderResponses.join(' | ')}`,
    );
    throw new Error(`Order placement did not navigate (click=${clickResult}). ${orderResponses.join(' | ')}`);
  }
  // Wait for the confirmation payload, not just the navigation/toast.
  await page.waitForFunction(() => /CRV-[A-Z0-9]{4,}/.test(document.body.innerText), { timeout: 25000 });
  const successText = await text(page);
  record('order can be placed end to end', successText.includes('Order placed'));
  record('success page shows the order number', /CRV-[A-Z0-9]{4,}/.test(successText));

  await goto(page, '/orders', 'My orders');
  record('order history lists the new order', (await count(page, '.order-card')) >= 1);

  await goto(page, '/profile', 'Personal details');
  record('profile page renders with addresses tab', (await text(page)).includes('Addresses'));

  // Clean up: cancel the order through the API so demo stock stays healthy.
  const token = await page.evaluate(() => localStorage.getItem('craveo:token'));
  const ordersResponse = await fetch(`${API}/api/orders?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ordersBody = await ordersResponse.json();
  const latest = ordersBody.data?.[0];
  if (latest?.status === 'PENDING' || latest?.status === 'CONFIRMED') {
    await fetch(`${API}/api/orders/${latest.id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'UI smoke test cleanup' }),
    });
  }
  record('smoke order was cleaned up', Boolean(latest), `order #${latest?.id ?? 'n/a'}`);

  /* --------------------------------- admin ------------------------------- */
  const adminContext = await browser.createBrowserContext();
  const adminPage = await adminContext.newPage();
  attachLogging(adminPage, 'admin');
  await adminPage.setViewport({ width: 1440, height: 900 });

  await goto(adminPage, '/login', 'Welcome back');
  await adminPage.type('input[type=email]', 'admin@craveo.app');
  await adminPage.type('input[type=password]', 'Admin@123');
  await Promise.all([
    adminPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
    adminPage.click('button[type=submit]'),
  ]);
  await adminPage.waitForFunction(() => location.pathname === '/admin', { timeout: 20000 });

  await adminPage.waitForFunction(() => document.body.innerText.includes('Revenue'), { timeout: 20000 });
  const dashboard = await text(adminPage);
  record('admin dashboard renders KPIs', dashboard.includes('Revenue') && dashboard.includes('Delivered orders'));
  record('admin dashboard renders charts', (await count(adminPage, '.recharts-surface')) >= 2);
  record('dashboard has no horizontal overflow', !(await hasHorizontalOverflow(adminPage)));

  await goto(adminPage, '/admin/foods', 'Dishes');
  record('admin dish table renders rows', (await count(adminPage, '.data-table tbody tr')) >= 5);

  await goto(adminPage, '/admin/orders', 'Orders');
  record('admin order queue renders rows', (await count(adminPage, '.data-table tbody tr')) >= 1);

  await goto(adminPage, '/admin/categories', 'Categories');
  record('admin categories render', (await count(adminPage, '.data-table tbody tr')) >= 5);

  await goto(adminPage, '/admin/coupons', 'Coupons');
  record('admin coupons render', (await count(adminPage, '.data-table tbody tr')) >= 3);

  await goto(adminPage, '/admin/banners', 'Banners');
  record('admin banners render', (await count(adminPage, '.card')) >= 2);

  await goto(adminPage, '/admin/reviews', 'Reviews');
  record('admin reviews render', (await text(adminPage)).includes('Reviews'));

  await goto(adminPage, '/admin/users', 'Users & roles');
  record('admin users render', (await count(adminPage, '.data-table tbody tr')) >= 4);

  await goto(adminPage, '/admin/settings', 'Site settings');
  record('admin settings form renders', (await count(adminPage, 'input.input')) >= 10);

  /* ---------------------------- mobile viewport -------------------------- */
  const mobilePage = await context.newPage();
  attachLogging(mobilePage, 'mobile');
  await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await goto(mobilePage, '/', 'Your cravings');
  const tabsVisible = await mobilePage.$eval('.mobile-tabs', (node) => getComputedStyle(node).display !== 'none');
  record('mobile tab bar is visible on small screens', tabsVisible);
  record('home has no horizontal overflow on mobile', !(await hasHorizontalOverflow(mobilePage)));

  await goto(mobilePage, '/foods', 'Explore the menu');
  record('menu has no horizontal overflow on mobile', !(await hasHorizontalOverflow(mobilePage)));
  record('food grid collapses to two columns', (await mobilePage.$$eval('.grid--foods', (nodes) => {
    const style = getComputedStyle(nodes[0]);
    return style.gridTemplateColumns.split(' ').length;
  })) <= 2);

  await goto(mobilePage, '/restaurants', 'Restaurants near you');
  record('restaurant listing fits mobile width', !(await hasHorizontalOverflow(mobilePage)));

  // Admin panel on a phone: sidebar must be off-canvas, not overflowing.
  const mobileAdmin = await adminContext.newPage();
  attachLogging(mobileAdmin, 'mobile-admin');
  await mobileAdmin.setViewport({ width: 390, height: 844, isMobile: true });
  await goto(mobileAdmin, '/admin', 'Revenue');
  record('admin dashboard fits mobile width', !(await hasHorizontalOverflow(mobileAdmin)));
  const sidebarHidden = await mobileAdmin.$eval('.admin-sidebar', (node) => node.getBoundingClientRect().right <= 1);
  record('admin sidebar is off-canvas on mobile', sidebarHidden);
} catch (error) {
  failures.push(`FATAL: ${error.message}`);
  console.error('FATAL', error);
} finally {
  await browser.close();
}

if (consoleErrors.length) {
  console.log('\nConsole / page errors:');
  for (const entry of [...new Set(consoleErrors)]) console.log(` - ${entry}`);
}

const passed = checks.filter((check) => check.ok).length;
console.log(`\n${passed}/${checks.length} UI checks passed · ${consoleErrors.length} browser errors`);
process.exit(failures.length || consoleErrors.length ? 1 : 0);
