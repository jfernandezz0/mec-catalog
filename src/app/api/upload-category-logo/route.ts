import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Upload to Supabase Storage inside 'logos' folder
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(`logos/${fileName}`, buffer, {
        contentType: file.type || 'image/png',
        upsert: true, // Permits overwriting
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Error al subir a Supabase Storage: ${uploadError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, fileName });
  } catch (error: any) {
    console.error('Error al subir el logo de la categoría:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la subida del logo.' },
      { status: 500 }
    );
  }
}
