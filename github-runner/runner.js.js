/*************************************************
 * ORDER RUNNER – GITHUB ACTION READY
 * STEP 1: READ GOOGLE SHEET (FIXED)
 *************************************************/

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

// ==============================
// CONFIG
// ==============================

const SHEET_ID = "1g8bxorpSd56EB72QKhkLiTjgTeKluiYH6JESot06tz8";
const SHEET_NAME = "ORDER_INPUT";

// ==============================
// AUTH
// ==============================

if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error("❌ Missing Google credentials in environment variables");
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
  try {
    console.log("🚀 Runner started...");

    const doc = new GoogleSpreadsheet(SHEET_ID, authClient);
    await doc.loadInfo();

    console.log("✅ Auth success");
    console.log("📄 Spreadsheet title:", doc.title);

    const sheet = doc.sheetsByTitle[SHEET_NAME];
    if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found`);
    }

    // 🔑 CRITICAL FIX
    await sheet.loadHeaderRow();

    console.log("📑 Header row loaded");
    console.log("🔑 Headers:", sheet.headerValues);

    // Read rows AFTER headers are loaded
    const rows = await sheet.getRows();
    console.log(`📦 Total rows found: ${rows.length}`);

    if (!rows.length) {
      console.log("⚠️ No data rows found");
      return;
    }

    // Detect Order ID column safely
    const orderIdHeader = sheet.headerValues.find(h =>
      h.toLowerCase().replace(/_/g, "").includes("order")
    );

    if (!orderIdHeader) {
      throw new Error("❌ Order_ID column not found in header row");
    }

    console.log(`✅ Using "${orderIdHeader}" as Order ID column`);

    // Log rows
    rows.forEach((row, index) => {
      const orderId = row[orderIdHeader];
      const status = row.Status || row.status || "";

      if (!orderId) {
        console.log(`⚠️ Row ${index + 2} skipped (empty Order ID)`);
        return;
      }

      console.log(
        `Row ${index + 2} | Order_ID: ${orderId} | Status: ${status}`
      );
    });

    console.log("🎉 Runner finished successfully");

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    process.exit(1);
  }
}

// ==============================
// EXECUTE
// ==============================

run();
