import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isValidISOCode } from '@/lib/utils';
import { verifyAdminSession } from '@/lib/utils.server';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación del administrador
    const authResult = await verifyAdminSession(request);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.error || 'No autorizado' },
        { status: authResult.statusCode || 401 }
      );
    }

    // 2. Extraer y validar el formulario
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    const countryCode = formData.get('countryCode') as string | null;

    if (!file || !countryCode) {
      return NextResponse.json(
        { error: 'Se requiere el archivo de logo y el código de país.' },
        { status: 400 }
      );
    }

    // Validar tipo de archivo
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    if (!isPng) {
      return NextResponse.json(
        { error: 'El logotipo debe ser una imagen en formato PNG.' },
        { status: 400 }
      );
    }

    // Validar tamaño de archivo (máx 2MB)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'El logotipo no debe superar los 2 MB.' },
        { status: 400 }
      );
    }

    // 3. Validar el código de país
    const code = countryCode.toUpperCase().trim();
    if (!isValidISOCode(code)) {
      return NextResponse.json(
        { error: `El código de país "${code}" no es un código ISO válido.` },
        { status: 400 }
      );
    }

    // 4. Validar el formato del nombre del archivo: debe ser MEC_[codigo ISO].png (por ejemplo: MEC_ES.png)
    const fileNameClean = file.name.toUpperCase().trim();
    const expectedNameMEC = `MEC_${code}.PNG`;
    
    if (fileNameClean !== expectedNameMEC) {
      return NextResponse.json(
        { error: `El nombre del archivo debe ser exactamente "MEC_${code.toLowerCase()}.png" (ej. MEC_${code}.png).` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `MEC_${code}.png`;

    // 5. Subir a Supabase Storage en la carpeta 'logos' usando el cliente admin
    const dbAdmin = getSupabaseAdmin();
    const { error: uploadError } = await dbAdmin.storage
      .from('product-images')
      .upload(`logos/${fileName}`, buffer, {
        contentType: 'image/png',
        upsert: true, // Permite sobreescribir el archivo existente
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Error al subir a Supabase Storage: ${uploadError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, fileName });
  } catch (error) {
    console.error('Error al subir el logo de la categoría:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error al procesar la subida del logo.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

