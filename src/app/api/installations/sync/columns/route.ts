import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const SYNC_CONFIG_ID = "default";

function canManageColumns(role: string) {
  return role === "MASTER" || role === "ADMIN" || role === "MANAGER";
}

async function getSheetHeaders() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!clientEmail || !privateKey || !spreadsheetId) {
    throw new Error("Google Sheets sync is not configured on the server.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheetName = process.env.GOOGLE_SHEET_NAME || "DATA";
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A1:ZZ1`,
  });

  const headerRow = response.data.values?.[0] || [];
  // Keep non-empty, trimmed header names
  return headerRow.map((h) => (h || "").toString().trim()).filter((h) => h.length > 0);
}

// GET: returns the full list of columns available in the sheet, plus the
// currently saved selection (defaults to "all columns" if never configured).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canManageColumns(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const available = await getSheetHeaders();

    const config = await prisma.syncConfig.findUnique({ where: { id: SYNC_CONFIG_ID } });
    const selected = config ? (config.columns as string[]) : available;

    return NextResponse.json({ available, selected }, { status: 200 });
  } catch (error) {
    console.error("Error fetching sheet columns:", error);
    return NextResponse.json({ message: "Failed to fetch columns from Google Sheets" }, { status: 500 });
  }
}

// POST: saves which columns should be pulled in and displayed for Installations.
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canManageColumns(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const columns = body.columns;

    if (!Array.isArray(columns) || columns.some((c) => typeof c !== "string")) {
      return NextResponse.json({ message: "columns must be an array of strings" }, { status: 400 });
    }

    const config = await prisma.syncConfig.upsert({
      where: { id: SYNC_CONFIG_ID },
      update: { columns },
      create: { id: SYNC_CONFIG_ID, columns },
    });

    return NextResponse.json({ columns: config.columns }, { status: 200 });
  } catch (error) {
    console.error("Error saving sheet columns:", error);
    return NextResponse.json({ message: "Failed to save column selection" }, { status: 500 });
  }
}
