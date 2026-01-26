/*************************************************
 * DOLE ORDER RUNNER – FULL PIPELINE
 * 1. Read ORDER_INPUT
 * 2. Scrape DOLE
 * 3. Write AUTO_SNAPSHOT
 * 4. Update Last_Processed
 *************************************************/

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const puppeteer = require("puppeteer");

// ==============================
// CONFIG
// ==============================

const SHEET_ID = "1g8bxorpSd56EB72QKhkLiTjgTeKluiYH6JESot06tz8";

const INPUT_SHEET = "ORDER_INPUT";
const OUTPUT_SHEET = "AUTO_SNAPSHOT";

const DOLE_URL = "https://dole.my.salesforce-sites.com/truckerinfo";
const TIMEOUT = 45000;

// ==============================
// AUTH
// ==============================

if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error("❌ Missing Google credentials");
  process.exit(1);
}

const authClient = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// ==============================
// MAIN
// ==============================

async function run() {
  console.log("🚀 Runner started");

  // ---------- GOOGLE SHEETS ----------
  const doc = new GoogleSpreadsheet(SHEET_ID, authClient);
  await doc.loadInfo();

  console.log("📄 Spreadsheet:", doc.title);

  const inputSheet = doc.sheetsByTitle[INPUT_SHEET];
  const outputSheet = doc.sheetsByTitle[OUTPUT_SHEET];

  if (!inputSheet || !outputSheet) {
    throw new Error("❌ Required sheet missing");
  }

  await inputSheet.loadHeaderRow();
  await outputSheet.loadHeaderRow();

  const rows = await inputSheet.getRows();
  console.log(`📦 Orders found: ${rows.length}`);

  // ---------- PUPPETEER ----------
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  for (const row of rows) {
    const orderId = row.get("Order_ID");
    const lastProcessed = row.get("Last_Processed");

    if (!orderId) continue;
    if (lastProcessed) {
      console.log(`⏭ Skipping ${orderId} (already processed)`);
      continue;
    }

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
          Order_ID: tds[1].innerText.replace("Order #", "").trim(),
          Cargo_Description: tds[0].innerText.trim(),
          Status: tds[2].innerText.trim(),
          Pickup_Date: tds[3].innerText.trim(),
          Carrier: tds[4].innerText.trim(),
          Container: tds[5].innerText.trim(),
          Last_Updated: new Date().toISOString(),
        };
      });

      if (!data) {
        console.log(`⚠️ No data found for ${orderId}`);
        continue;
      }

      // ---------- WRITE AUTO_SNAPSHOT ----------
      await outputSheet.addRow(data);

      // ---------- UPDATE INPUT SHEET ----------
      row.set("Status", data.Status);
      row.set("Last_Processed", new Date().toISOString());
      await row.save();

      console.log(`✅ Completed ${orderId}`);

    } catch (err) {
      console.error(`❌ Failed ${orderId}:`, err.message);
    }
  }

  await browser.close();
  console.log("🎉 All done");
}

// ==============================
// EXECUTE
// ==============================

run().catch(err => {
  console.error("🔥 Fatal error:", err.message);
  process.exit(1);
});
