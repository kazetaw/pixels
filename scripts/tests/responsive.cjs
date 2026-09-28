/* Browser layout regression checks. API responses are isolated fixtures; no
 * request from this browser can write to local or production databases.
 * PLAYWRIGHT_MODULE=/path/to/playwright node scripts/tests/responsive.cjs
 * Start Vite on :5173 first. Screenshots/report go to /tmp/pixels-responsive-qa.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const out = process.env.QA_OUTPUT || '/tmp/pixels-responsive-qa/results';
fs.mkdirSync(out, { recursive: true });
const name = 'น้ำว่านหางจระเข้ลอยแก้วสูตรพิเศษสำหรับการผลิต';
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="8" fill="#bfdbfe"/><text x="8" y="28" font-size="24">🍋</text></svg>');
const machines = Array.from({ length: 6 }, (_, i) => ({ machine_id: `m${i}`, machine_name: `เครื่องผลิตวัคซีนและเซรุ่มรุ่นพิเศษ ${i}`, occupation: ['หมอ', 'เชฟ', 'ไอดอล', 'เกษตร', 'วิศวะกร', 'ทุกอาชีพ'][i], floor_number: i + 1, max_hours_limit: 120, image }));
const recipes = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, name: `${name} ${i}`, machine_id: `m${i % 6}`, time_per_unit: '02:30:00', ingredients: { raw: 99, r11: 12 }, image }));
const stocks = Object.fromEntries([...recipes.map(r => [r.id, 123456]), ['raw', 1234567]]);
const data = { recipes, machines, stocks, stockImages: { raw: image }, itemNames: Object.fromEntries([...recipes.map(r => [r.id, r.name]), ['raw', 'วัตถุดิบชื่อยาวมากสำหรับทดสอบการตัดบรรทัด']]) };
const floors = Array.from({ length: 27 }, (_, i) => ({ floor_number: i + 1, recipe_id: `r${i % 12}`, occupation: machines[i % 6].occupation }));
const shared = { event_days: 30, event_hours: 0, event_minutes: 0, floors, updated_at: '2026-09-28T00:00:00Z' };
const leaf = { item_id: 'raw', item_name: data.itemNames.raw, quantity_needed: 1234567, is_raw: true, children: [] };
const nested = { item_id: 'r11', item_name: name, quantity_needed: 123456, is_raw: false, children: [{ ...leaf, is_raw: false, children: [{ ...leaf, children: [leaf] }] }] };
const plan = { event_total_hours: 720, floor_results: floors.slice(0, 6).map((f, i) => ({ floor_number: f.floor_number, recipe_id: f.recipe_id, recipe_name: recipes[i].name, time_per_unit: '02:30:00', cycles: 200, output_qty: 123456, bom_tree: { item_id: f.recipe_id, item_name: recipes[i].name, quantity_needed: 123456, is_raw: false, children: [nested, leaf] } })), raw_materials: [{ item_id: 'raw', item_name: data.itemNames.raw, total_needed: 9999999, in_stock: 1234567, net_required: 8765432, sufficient: false }], intermediate_supply: [{ item_id: 'r11', item_name: name, needed: 1234567, produced: 123456, shortfall: 1111111, sufficient: false }] };
const purchases = recipes.map((r, i) => ({ id: `p${i}`, item_id: r.id, quantity: 123456, total_amount: 1234567, currency: i % 2 ? 'G' : 'THB', contributor: 'ต้วมเตี้ยม', source: 'ฟามเอง', purchased_at: '2026-09-28T00:00:00Z' }));
const budgets = { budgets: [{ currency: 'THB', limit_amount: 100000 }, { currency: 'G', limit_amount: 100000 }], purchases };
const timers = floors.slice(0, 6).map((f, i) => ({ ...f, profession: f.occupation, machine_id: `m${i}`, status: 'idle', start_time: null, estimated_duration_seconds: 3600, completed_at: null }));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = [];
  let activePage;
  const errors = [];
  try {
    for (const width of (process.env.QA_WIDTHS || '320,390,600,768,820,1024,1280,1440').split(',').map(Number)) {
      const context = await browser.newContext({ viewport: { width, height: Number(process.env.QA_HEIGHT || 900) }, hasTouch: width <= 600, reducedMotion: 'reduce' });
      let sharedPlan = structuredClone(shared);
      await context.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (!path.startsWith('/api/')) return route.continue();
        if (path === '/api/planner' && route.request().method() === 'PUT') sharedPlan = { ...route.request().postDataJSON(), updated_at: new Date().toISOString() };
        const responses = { '/api/data': data, '/api/budgets': budgets, '/api/purchases': purchases, '/api/planner': { plan: sharedPlan }, '/api/plan': plan, '/api/floors': timers, '/api/budgets/verify-pin': { ok: true }, '/api/calculate': { shopping_list: [{ item_id: 'raw', item_name: data.itemNames.raw, total_needed: 9999999, net_required: 8765432 }], machine_workloads: [{ ...machines[0], hours_required: 9999 }] } };
        await route.fulfill({ status: responses[path] ? 200 : 400, json: responses[path] || { error: 'Blocked by responsive QA fixture' } });
      });
      await context.addInitScript(({ floors }) => { localStorage.setItem('planner_floors', JSON.stringify(floors)); sessionStorage.setItem('pixel-budget-pin', 'test'); }, { floors });
      const page = await context.newPage(); activePage = page; page.setDefaultTimeout(10000);
      page.on('pageerror', e => errors.push({ width, error: e.message }));
      await page.goto(process.env.QA_URL || 'http://localhost:5173/');
      await page.getByRole('button', { name: /เพิ่ม Recipe$/ }).waitFor();
      const check = async label => {
        // Drawer/Modal positioning completes after their opening transition.
        await page.waitForTimeout(400);
        const result = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const visible = el => !el.closest('.ant-drawer:not(.ant-drawer-open)') && el.getBoundingClientRect().width && el.getBoundingClientRect().height && getComputedStyle(el).visibility !== 'hidden';
          const issues = [...document.querySelectorAll('input, button, .ant-select, .item-label, h1, h2, h3, .purchase-cell, .ant-modal-content, .ant-drawer-content')].filter(visible).filter(el => {
            let parent = el.parentElement;
            while (parent && parent !== document.body) {
              if (['auto', 'scroll', 'hidden'].includes(getComputedStyle(parent).overflowX) && parent.scrollWidth > parent.clientWidth + 1) return false;
              parent = parent.parentElement;
            }
            const r = el.getBoundingClientRect(); return r.right > vw + 2 || r.left < -2;
          }).map(el => ({ tag: el.tagName, class: String(el.className).slice(0, 100), text: (el.innerText || el.getAttribute('aria-label') || '').slice(0, 60) }));
          return { viewport: vw, documentWidth: document.documentElement.scrollWidth, issues };
        });
        report.push({ width, label, ...result });
        if ([320, 820, 1440].includes(width)) await page.screenshot({ path: `${out}/${width}-${label}.png`, fullPage: true });
      };
      const nav = async label => {
        if (width <= 768) await page.locator('.mobile-topbar button').click();
        await page.getByRole('menuitem', { name: new RegExp(label + '$') }).filter({ visible: true }).click();
        await page.waitForTimeout(150);
      };
      const close = async () => {
        const dialog = page.getByRole('dialog').filter({ visible: true }).last();
        await dialog.getByRole('button', { name: /Close|ปิด/ }).first().click();
        await page.waitForTimeout(350);
      };
      await nav('แผนส่วนตัว');
      await check('planner');
      await page.getByRole('combobox', { name: /สูตรชั้น 1$/ }).click();
      await page.waitForTimeout(400);
      if (process.env.QA_DEBUG) { console.log(await page.locator('.ant-select-dropdown').evaluateAll(nodes => nodes.map(el => ({ html: el.outerHTML.slice(0, 600), rect: el.getBoundingClientRect().toJSON() })))); }
      await check('recipe-select'); await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /คำนวณแผนการผลิต$/ }).click();
      await page.locator('.plan-summary').waitFor(); await check('summary');
      for (const [label, text] of [['summary-floors', 'แต่ละชั้น'], ['summary-occupations', 'แยกอาชีพ'], ['summary-raw', 'วัตถุดิบดิบ'], ['summary-processed', 'สินค้าแปรรูป']]) {
        await page.locator('.plan-summary-navigation button').filter({ hasText: text }).click(); await check(label);
        if (label === 'summary-floors') { await page.locator('.plan-floor-result').first().click(); await check('bom-drawer'); await close(); }
      }
      await nav('แผนส่วนกลาง'); await check('shared-planner');
      const machineField = page.getByRole('combobox', { name: 'เครื่องชั้น 1', exact: true });
      await machineField.click(); await check('machine-select');
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: `${machines[5].machine_name} · ชั้น 6` }).click();
      if ((await page.locator('.planner-entry-row').first().locator('.planner-recipe-field').innerText()).includes(recipes[0].name)) throw new Error('Changing machine kept incompatible recipe');
      await page.getByRole('combobox', { name: 'สูตรชั้น 1', exact: true }).click();
      const options = await page.locator('.ant-select-dropdown:visible .ant-select-item-option').allTextContents();
      if (options.some(text => text.includes(recipes[0].name)) || !options.some(text => text.includes(recipes[5].name))) throw new Error('Machine recipe filtering failed');
      const saved = page.waitForResponse(response => response.url().endsWith('/api/planner') && response.request().method() === 'PUT' && response.request().postDataJSON().floors[0].recipe_id === 'r5');
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: recipes[5].name }).click(); await saved;
      if (sharedPlan.floors[0].machine_id !== 'm5') throw new Error('Shared plan omitted selected machine');
      await page.reload(); await nav('แผนส่วนกลาง');
      await page.locator('.planner-entry-row').first().getByText(machines[5].machine_name, { exact: true }).waitFor();
      await check('shared-machine-restored');
      await nav('แผนส่งต่อ'); await page.locator('.production-flow-card').first().waitFor(); await page.locator('.production-flow-details summary').first().click(); await check('flow');
      await nav('จัดการข้อมูล'); await check('recipes');
      await page.getByRole('button', { name: /ดูรูปขนาดใหญ่$/ }).first().click(); await check('image-preview'); await close();
      await page.getByRole('button', { name: /เพิ่ม Recipe$/ }).click(); await check('recipe-modal');
      await page.getByRole('checkbox', { name: /ไม่มีเวลาแปรรูป/ }).uncheck(); await check('recipe-time'); await close();
      await page.locator('.recipe-table button').filter({ has: page.locator('[aria-label="edit"]') }).first().click(); await check('recipe-edit'); await close();
      await page.getByRole('button', { name: /เครื่องจักร$/ }).click(); await check('machines');
      await page.getByRole('button', { name: /เพิ่มเครื่องจักร$/ }).click(); await check('machine-modal'); await close();
      await page.getByRole('button', { name: /สต็อกวัตถุดิบ$/ }).click(); await check('stocks');
      await page.getByRole('button', { name: /เพิ่มรายการ$/ }).click(); await check('stock-modal'); await close();
      await page.getByRole('button', { name: /^แก้ชื่อ / }).first().click(); await check('stock-rename'); await close();
      await page.getByRole('button', { name: /งบประมาณ$/ }).click(); await check('purchase');
      const qty = page.getByRole('textbox', { name: /จำนวนที่ซื้อ$/ }).first();
      await qty.fill('99 + 22'); await qty.press('Enter');
      if (await qty.inputValue() !== '121') throw new Error('Quantity Enter regression');
      await page.getByRole('button', { name: /\+99$/ }).first().click();
      if (await qty.inputValue() !== '220') throw new Error('Quantity +99 regression');
      await page.getByRole('button', { name: /แก้ไข$/ }).first().click(); await check('purchase-edit'); await close();
      await page.getByRole('button', { name: /สรุปการเติมสต็อก/ }).click(); await check('contribution'); await close();
      await page.getByRole('button', { name: /เปิดหน้าคำนวณ BOM$/ }).click(); await check('bom-workspace');
      await page.getByPlaceholder('จำนวน', { exact: true }).fill('99999');
      await page.getByRole('button', { name: /เพิ่ม$/ }).click();
      await page.getByRole('button', { name: /คำนวณ$/ }).click();
      await page.locator('.bom-workspace__result-grid').waitFor(); await check('bom-results');
      await page.getByRole('button', { name: /กลับไปหน้าหลัก$/ }).click();
      await nav('คลังสต็อก'); await check('inventory');
      await nav('สถานะชั้น'); await page.locator('.floor-card').first().waitFor(); await check('floors');
      await page.getByRole('button', { name: /ตั้งค่าเครื่องชั้น 1$/ }).click(); await check('floor-config'); await close();
      await page.getByRole('button', { name: /เริ่ม$/ }).first().click(); await check('floor-timer'); await close();
      await page.getByRole('button', { name: /เพิ่มชั้น$/ }).click(); await check('floor-add'); await close();
      await nav('เป้าหมายการผลิต'); await page.locator('.production-targets__material').first().waitFor();
      for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^ขยายวัตถุดิบของ/ }).first().click();
      await check('targets-expanded');
      await nav('งบประมาณ'); await check('budget');
      await page.getByRole('button', { name: /แก้ไขงบ$/ }).first().click(); await check('budget-edit'); await close();
      await nav('ผังบริษัท'); await check('organization');
      await page.evaluate(() => sessionStorage.clear());
      await nav('จัดการข้อมูล'); await page.getByRole('button', { name: /งบประมาณ$/ }).click(); await check('pin-gate');
      await nav('งบประมาณ'); await page.getByRole('button', { name: /แก้ไขงบ$/ }).first().click(); await check('pin-modal'); await close();
      await page.goto('http://localhost:5173/inventory'); await page.locator('.ant-table-row').first().waitFor(); await check('public-inventory');
      await page.locator('.inventory-search input').fill('ไม่พบสินค้าทดสอบนี้'); await check('inventory-empty');
      if (width === 320) {
        await context.route('**/api/floors', route => route.fulfill({ status: 503, json: { error: 'ระบบไม่พร้อมใช้งานชั่วคราว กรุณาลองโหลดสถานะชั้นผลิตใหม่อีกครั้ง' } }));
        await page.goto('http://localhost:5173/'); await nav('สถานะชั้น'); await check('floors-error');
      }
      await context.close();
      console.log(`Completed ${width}px`);
    }
  } catch (error) {
    if (activePage) { await activePage.screenshot({ path: `${out}/failure.png`, fullPage: true }); console.log((await activePage.locator('body').innerText()).slice(0, 3000)); }
    throw error;
  } finally {
    await browser.close();
    fs.writeFileSync(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2));
    const failures = report.filter(r => r.documentWidth > r.viewport + 2 || r.issues.length);
    console.log(JSON.stringify({ checks: report.length, failures, errors }, null, 2));
    if (failures.length || errors.length) process.exitCode = 1;
  }
})();
