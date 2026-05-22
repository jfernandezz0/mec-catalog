import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidISOCode } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación del usuario mediante token Bearer
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado. Debes iniciar sesión como administrador.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Inicializar cliente de Supabase específico para esta petición usando el JWT del usuario
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Sesión no válida o expirada. Por favor, inicia sesión de nuevo.' },
        { status: 401 }
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

    // 5. Subir a Supabase Storage en la carpeta 'logos' usando el cliente autenticado
    const { error: uploadError } = await supabaseClient.storage
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
  } catch (error: any) {
    console.error('Error al subir el logo de la categoría:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar la subida del logo.' },
      { status: 500 }
    );
  }
}

