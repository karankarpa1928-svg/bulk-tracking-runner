/*************************************************
 * ORDER RUNNER – GITHUB ACTION READY
 * READ ORDER_INPUT SHEET (FINAL)
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

    // 🔑 REQUIRED
    await sheet.loadHeaderRow();

    console.log("📑 Headers:", sheet.headerValues);

    const rows = await sheet.getRows();
    console.log(`📦 Total rows found: ${rows.length}`);

    rows.forEach((row, index) => {
      const orderId = row.get("Order_ID");
      const status = row.get("Status") || "";

      if (!orderId) {
        console.log(`⚠️ Row ${index + 2} skipped (empty Order_ID)`);
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
