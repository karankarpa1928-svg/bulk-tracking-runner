/*************************************************
 * ORDER RUNNER – GITHUB ACTION READY
 * STEP 1: READ SHEET ONLY
 *************************************************/

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

// ==============================
// CONFIG
// ==============================

// Spreadsheet ID ONLY (no /edit, no gid)
const SHEET_ID = "1g8bxorpSd56EB72QKhkLiTjgTeKluiYH6JESot06tz8";

// Sheet name to read
const SHEET_NAME = "ORDER_INPUT";

// ==============================
// AUTH (ENV BASED – GITHUB SAFE)
// ==============================

if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error("❌ Missing Google credentials in environment variables");
  process.exit(1);
}

const authClient = new JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
  ],
});

// ==============================
// MAIN
// ==============================

async function run() {
  try {
    console.log("🚀 Runner started...");

    // Create spreadsheet instance WITH AUTH
    const doc = new GoogleSpreadsheet(SHEET_ID, authClient);

    // Load spreadsheet info
    await doc.loadInfo();

    console.log("✅ Auth success");
    console.log("📄 Spreadsheet title:", doc.title);

    // Get target sheet
    const sheet = doc.sheetsByTitle[SHEET_NAME];
    if (!sheet) {
      throw new Error(`Sheet "${SHEET_NAME}" not found`);
    }

    // Read rows
    const rows = await sheet.getRows();
    console.log(`📦 Total rows found: ${rows.length}`);

    // Log row data
    rows.forEach((row, index) => {
      console.log(
        `Row ${index + 2} | Order_ID: ${row.Order_ID} | Status: ${row.Status}`
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
