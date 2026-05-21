import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    const countryCode = formData.get('countryCode') as string | null;

    if (!file || !countryCode) {
      return NextResponse.json(
        { error: 'Se requiere el archivo de logo y el código de país.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const code = countryCode.toUpperCase().trim();
    const fileName = `MEC_${code}.png`;
    const publicDir = path.join(process.cwd(), 'public');
    const filePath = path.join(publicDir, fileName);

    // Ensure the public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Save the file
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ success: true, fileName });
  } catch (error: any) {
    console.error('Error al subir el logo de la categoría:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la subida del logo.' },
      { status: 500 }
    );
  }
}
