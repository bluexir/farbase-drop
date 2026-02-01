import { NextResponse } from "next/server";

export async function GET() {
  const domain = "farbase-drop.vercel.app";
  const fid = 429973;
  
  // Vercel env'den mnemonic al
  const mnemonic = process.env.FARCASTER_DEVELOPER_MNEMONIC;
  
  if (!mnemonic) {
    return NextResponse.json(
      { 
        error: "MNEMONIC not configured",
        message: "Add FARCASTER_DEVELOPER_MNEMONIC to Vercel env variables" 
      },
      { status: 500 }
    );
  }

  try {
    // NOT: Gerçek imza oluşturma için @farcaster/hub-nodejs kurulumu gerekli
    // Şimdilik placeholder değerler - kullanıma hazır olduktan sonra 
    // Farcaster'dan alınan gerçek imza ile değiştirilecek
    
    const manifest = {
      accountAssociation: {
        // Bu alanlar FID 429973 private key'i ile imzalanmalı
        // Şimdilik örnek değerler, sonra elle veya otomatik doldurulacak
        header: "GENERATED_FROM_MNEMONIC_HEADER",
        payload: "GENERATED_FROM_MNEMONIC_PAYLOAD", 
        signature: "GENERATED_FROM_MNEMONIC_SIGNATURE"
      },
      frame: {
        version: "1",
        name: "FarBase Drop",
        iconUrl: `https://${domain}/icon.png`,
        homeUrl: `https://${domain}`,
        imageUrl: `https://${domain}/preview.png`,
        buttonTitle: "Play Tournament",
        splashImageUrl: `https://${domain}/splash.png`,
        splashBackgroundColor: "#000000",
        webhookUrl: `https://${domain}/api/webhook`
      }
    };
    
    return NextResponse.json(manifest, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
    
  } catch (error) {
    console.error("Frame manifest error:", error);
    return NextResponse.json(
      { error: "Failed to generate manifest" },
      { status: 500 }
    );
  }
}
