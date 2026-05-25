import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MultipartField = {
  name: string;
  filename: string | null;
  contentType: string | null;
  data: Buffer;
};

function splitBuffer(buffer: Buffer, separator: Buffer) {
  const parts: Buffer[] = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

function trimMultipartPart(buffer: Buffer) {
  let start = 0;
  let end = buffer.length;

  // leading CRLF
  if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;

  // trailing CRLF
  if (end >= 2 && buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2;

  // final boundary suffix can leave "--"
  if (end >= 2 && buffer[end - 2] === 45 && buffer[end - 1] === 45) end -= 2;
  if (end >= 2 && buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2;

  return buffer.subarray(start, end);
}

function parseContentDisposition(value: string) {
  const nameMatch = value.match(/name="([^"]+)"/);
  const filenameMatch = value.match(/filename="([^"]*)"/);

  return {
    name: nameMatch?.[1] ?? "",
    filename: filenameMatch?.[1] ? filenameMatch[1] : null,
  };
}

function parseMultipartBody(body: Buffer, contentType: string) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    throw new Error("Multipart boundary fehlt.");
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const rawParts = splitBuffer(body, boundaryBuffer);
  const fields: MultipartField[] = [];

  for (const rawPart of rawParts) {
    const part = trimMultipartPart(rawPart);

    if (part.length === 0) continue;
    if (part.equals(Buffer.from("--"))) continue;

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) continue;

    const headerText = part.subarray(0, headerEnd).toString("utf8");
    const data = part.subarray(headerEnd + 4);

    const headerLines = headerText.split("\r\n");
    const headers = new Map<string, string>();

    for (const line of headerLines) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      headers.set(key, value);
    }

    const disposition = headers.get("content-disposition");
    if (!disposition) continue;

    const { name, filename } = parseContentDisposition(disposition);
    if (!name) continue;

    fields.push({
      name,
      filename,
      contentType: headers.get("content-type") ?? null,
      data,
    });
  }

  return fields;
}

function getTextField(fields: MultipartField[], name: string) {
  const field = fields.find((item) => item.name === name && !item.filename);
  return field ? field.data.toString("utf8").trim() : "";
}

function getFileField(fields: MultipartField[], name: string) {
  return fields.find((item) => item.name === name && item.filename);
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        {
          ok: false,
          error: `Upload ist kein multipart/form-data. Content-Type: ${contentType || "leer"}`,
        },
        { status: 400 }
      );
    }

    const rawBody = Buffer.from(await req.arrayBuffer());
    const expectedBodyBytes = Number(req.headers.get("content-length") ?? 0);

    if (
      Number.isFinite(expectedBodyBytes) &&
      expectedBodyBytes > 0 &&
      rawBody.length < expectedBodyBytes
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: `Upload wurde unterwegs abgeschnitten. Empfangen: ${rawBody.length} Bytes, erwartet: ${expectedBodyBytes} Bytes. Bitte proxyClientMaxBodySize in next.config.ts erhöhen und Datei neu hochladen.`,
        },
        { status: 413 }
      );
    }
    const fields = parseMultipartBody(rawBody, contentType);

    const headerToken = req.headers.get("x-admin-token") ?? "";
    const bodyToken = getTextField(fields, "token");
    const token = headerToken || bodyToken;

    if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const category2Id = getTextField(fields, "category2Id");
    const month = getTextField(fields, "month");
    const file = getFileField(fields, "file");

    if (!category2Id) {
      return NextResponse.json({ ok: false, error: "category2Id fehlt" }, { status: 400 });
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { ok: false, error: 'Month muss im Format YYYY-MM sein (z.B. "2026-02")' },
        { status: 400 }
      );
    }

    if (!file || file.data.length === 0) {
      return NextResponse.json({ ok: false, error: "file fehlt oder ist leer" }, { status: 400 });
    }

    const text = new TextDecoder("utf-8").decode(file.data);

    const batch = await prisma.importBatch.create({
      data: {
        category2Id,
        month,
        status: "UPLOADED",
      },
    });

    const importFile = await prisma.importFile.create({
      data: {
        batchId: batch.id,
        filename: file.filename ?? "upload.csv",
        status: "UPLOADED",
        mimeType: file.contentType,
        sizeBytes: file.data.length,
        contentText: text,
      },
    });

    return NextResponse.json({
      ok: true,
      batchId: batch.id,
      fileId: importFile.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "unknown error",
      },
      { status: 500 }
    );
  }
}