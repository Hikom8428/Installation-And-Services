import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const SYNC_CONFIG_ID = "default";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "MASTER" && session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
      console.error("Google Sheets sync is not configured: missing GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_SHEET_ID env vars.");
      return NextResponse.json({ message: "Google Sheets sync is not configured on the server." }, { status: 500 });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheetName = process.env.GOOGLE_SHEET_NAME || "DATA";
    const sheets = google.sheets({ version: "v4", auth });

    // Fetch the header row (row 1) plus all data rows (row 2 onwards)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:ZZ1000`,
    });

    const allRows = response.data.values;

    if (!allRows || allRows.length < 2) {
      return NextResponse.json({ message: "No data found in sheet." }, { status: 200 });
    }

    const header = allRows[0].map((h) => (h || "").toString().trim());
    const dataRows = allRows.slice(1);

    // Which columns to actually store/display — falls back to every column
    // in the sheet if the user hasn't configured a selection yet.
    const config = await prisma.syncConfig.findUnique({ where: { id: SYNC_CONFIG_ID } });
    const selectedColumns = config ? (config.columns as string[]) : header;

    // Identity columns, looked up by name regardless of what's selected for display
    const jobNoIndex = header.findIndex((h) => h.toLowerCase() === "job no");
    const clientNameIndex = header.findIndex((h) => h.toLowerCase() === "client name");
    const orderDetailsIndex = header.findIndex((h) => h.toLowerCase() === "order details");

    let syncedCount = 0;
    let updatedCount = 0;

    for (const row of dataRows) {
      const sourceId = jobNoIndex >= 0 ? (row[jobNoIndex] || "").toString().trim() : "";
      const customerName = (clientNameIndex >= 0 ? row[clientNameIndex] : "")?.toString().trim() || "";
      const productDetails = orderDetailsIndex >= 0 ? (row[orderDetailsIndex] || "").toString().trim() : "";

      if (!sourceId && !customerName) continue; // skip fully empty rows

      // Build the display data object from only the currently selected columns
      const data: Record<string, string> = {};
      selectedColumns.forEach((col) => {
        const idx = header.indexOf(col);
        if (idx >= 0) data[col] = (row[idx] || "").toString();
      });

      if (sourceId) {
        // Reliable match on Job No: create new rows, refresh existing ones on re-sync
        const existing = await prisma.installation.findUnique({ where: { sourceId } });
        if (existing) {
          await prisma.installation.update({
            where: { sourceId },
            data: { customerName: customerName || existing.customerName, productDetails, data },
          });
          updatedCount++;
        } else {
          await prisma.installation.create({
            data: { sourceId, customerName: customerName || sourceId, productDetails, data, status: "PENDING" },
          });
          syncedCount++;
        }
      } else {
        // Fallback for rows without a Job No — old name+details dedupe
        const existing = await prisma.installation.findFirst({
          where: { customerName, productDetails },
        });
        if (!existing) {
          await prisma.installation.create({
            data: { customerName, productDetails, data, status: "PENDING" },
          });
          syncedCount++;
        }
      }
    }

    return NextResponse.json(
      { message: `Sync completed! ${syncedCount} new, ${updatedCount} updated.` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ message: "Failed to sync with Google Sheets" }, { status: 500 });
  }
}
