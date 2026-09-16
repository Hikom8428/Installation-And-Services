import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import path from "path";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== "MASTER" && session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), "google-credentials.json"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    
    // Sheet ID from your URL
    const spreadsheetId = "1dwKsnjV7SPM7SaIFBqTHKRKPfQ5FIIDrcFdk5PvGG1c";
    
    // Fetching from DATA tab, row 2 onwards to skip headers
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "'DATA'!A2:Z1000", 
    });

    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: "No data found in sheet." }, { status: 200 });
    }

    let syncedCount = 0;

    for (const row of rows) {
      const customerName = row[3] || ""; // Column D (Client Name)
      const productDetails = row[5] || ""; // Column F (Order Details)

      if (!customerName) continue; // Skip empty rows

      // Check if this installation already exists based on Name & Details
      const existing = await prisma.installation.findFirst({
        where: {
          customerName,
          productDetails
        }
      });

      if (!existing) {
        await prisma.installation.create({
          data: {
            customerName,
            productDetails,
            status: "PENDING"
          }
        });
        syncedCount++;
      }
    }

    return NextResponse.json({ message: `Sync completed! ${syncedCount} new installations added.` }, { status: 200 });

  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ message: "Failed to sync with Google Sheets" }, { status: 500 });
  }
}

