import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Public complaint/site-visit/task-step forms accept uploads from anonymous
// or low-trust users. The browser's `accept="image/*"` attribute and the
// original filename/extension are both attacker-controlled and easy to
// spoof (e.g. POSTing a file named "photo.jpg" whose content is actually a
// PHP or HTML payload straight at the API, bypassing the <input> entirely).
// To keep an uploaded file from ever landing in `public/uploads` with a
// dangerous extension, we sniff the actual file signature (magic bytes) and
// always derive the on-disk extension from that — never from the filename
// the client sent.
export type UploadKind = "image" | "video" | "pdf";

const SIGNATURES: { kind: UploadKind; ext: string; check: (buf: Buffer) => boolean }[] = [
  { kind: "image", ext: "jpg", check: (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { kind: "image", ext: "png", check: (b) => b.length > 3 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { kind: "image", ext: "gif", check: (b) => b.length > 2 && b.subarray(0, 3).toString("ascii") === "GIF" },
  {
    kind: "image",
    ext: "webp",
    check: (b) => b.length > 11 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
  { kind: "pdf", ext: "pdf", check: (b) => b.length > 3 && b.subarray(0, 4).toString("ascii") === "%PDF" },
  // ISO base media container (mp4/mov/m4v all share this "ftyp" box) — saved as .mp4
  { kind: "video", ext: "mp4", check: (b) => b.length > 11 && b.subarray(4, 8).toString("ascii") === "ftyp" },
  { kind: "video", ext: "webm", check: (b) => b.length > 3 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
];

// Reads the file's magic bytes and returns a safe extension if it matches
// one of the allowed kinds, or null if the content doesn't match any known
// signature for those kinds (caller should reject the upload with a 400).
export function detectSafeExtension(buffer: Buffer, allowedKinds: UploadKind[]): string | null {
  for (const sig of SIGNATURES) {
    if (allowedKinds.includes(sig.kind) && sig.check(buffer)) return sig.ext;
  }
  return null;
}

// Writes an already-validated buffer under public/uploads/<subdir> using a
// random filename + the extension detected by detectSafeExtension — never
// the client-supplied filename.
export async function persistUpload(buffer: Buffer, ext: string, subdir: string): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", subdir);
  await mkdir(uploadDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(uploadDir, filename), buffer);
  return `/uploads/${subdir}/${filename}`;
}
