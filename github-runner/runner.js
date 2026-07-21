/*************************************************
 * DOLE ORDER RUNNER – CI SAFE FINAL VERSION
 *************************************************/

console.log("RUN AT:", new Date().toISOString());

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const puppeteer = require("puppeteer");
const axios = require("axios");

// ==============================
// CONFIG
// ==============================
const SHEET_ID = "1g8bxorpSd56EB72QKhkLiTjgTeKluiYH6JESot06tz8";
const INPUT_SHEET = "ORDER_INPUT";

const DOLE_URL = "https://dole.my.salesforce-sites.com/truckerinfo";
const TIMEOUT = 45000;

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyXJZDjQ2StG_rwE8psJtrwmV9eQoRMq4_C8Bh5mtmExe5FcFXuwGA2L98Mo2Dj0n5Vtg/exec";

// ==============================
// GOOGLE AUTH (ENV BASED)
// ==============================
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!clientEmail || !privateKey) {
  console.error("❌ Missing Google credentials");
  process.exit(1);
}

const auth = new JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// ==============================
// MAIN
// ==============================
async function run() {
  console.log("runner.js STARTED");

  // ---------- GOOGLE SHEETS ----------
  const doc = new GoogleSpreadsheet(SHEET_ID, auth);
  await doc.loadInfo();

  const inputSheet = doc.sheetsByTitle[INPUT_SHEET];
  if (!inputSheet) {
    throw new Error("❌ ORDER_INPUT sheet not found");
  }

  const rows = await inputSheet.getRows();
  console.log(`📦 Order IDs found: ${rows.length}`);

  const collectedRows = [];
  const failedOrders = [];

  // ---------- PUPPETEER ----------
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  for (const row of rows) {
    const orderId = row.get("Order_ID");
    if (!orderId) continue;

    console.log(`🔍 Processing Order ${orderId}`);

    try {
      await page.goto(DOLE_URL, { waitUntil: "domcontentloaded" });

      await page.waitForSelector(
        'input[name="j_id0:orderSearchForm:trackingId"]',
        { timeout: TIMEOUT }
      );

      await page.evaluate(() => {
        document.querySelector(
          'input[name="j_id0:orderSearchForm:trackingId"]'
        ).value = "";
      });

      await page.type(
        'input[name="j_id0:orderSearchForm:trackingId"]',
        orderId,
        { delay: 40 }
      );

      await page.click('button[type="submit"]');

      await page.waitForFunction(
        () => document.body.innerText.includes("Cargo"),
        { timeout: TIMEOUT }
      );

      const data = await page.evaluate(() => {
        const table = [...document.querySelectorAll("table")].find(t =>
          t.innerText.includes("Cargo Description")
        );
        if (!table) return null;

        const tds = table.querySelectorAll("tr")[1]?.querySelectorAll("td");
        if (!tds || tds.length < 6) return null;

        return {
          OrderNumber: tds[1].innerText.replace("Order #", "").trim(),
          CargoDescription: tds[0].innerText.trim(),
          OrderStatus: tds[2].innerText.trim(),
          PickupDate: tds[3].innerText.trim(),
          Carrier: tds[4].innerText.trim(),
          Container: tds[5].innerText.trim(),
        };
      });

      if (!data) {
        console.log(`⚠️ No data for ${orderId}`);
        continue;
      }

      collectedRows.push(data);
      console.log(`✅ Collected ${orderId}`);
    } catch (err) {
  console.error(`❌ Failed ${orderId}:`, err.message);

  failedOrders.push({
    OrderNumber: orderId,
    Error: err.message
  });
}
}

  await browser.close();

  // ---------- SEND TO APPS SCRIPT ----------
  if (collectedRows.length) {
    console.log(`📤 Sending ${collectedRows.length} rows to Apps Script`);
    await axios.post(APPS_SCRIPT_URL, {
  rows: collectedRows,
  failedOrders: failedOrders
});
  } else {
    console.log("ℹ️ No rows to send");
  }

  console.log("🎉 All done");
}

// ==============================
// EXECUTE
// ==============================
run().catch(err => {
  console.error("🔥 Fatal error:", err);
  process.exit(1);
});
