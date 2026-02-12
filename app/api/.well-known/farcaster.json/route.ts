import { NextResponse } from "next/server";
import { Wallet } from "ethers";

export const runtime = "nodejs";

export async function GET() {
  const domain = "farbase-drop.vercel.app";
  const fid = 429973;

  // Vercel env'den mnemonic al
  const mnemonic = process.env.FARCASTER_DEVELOPER_MNEMONIC;

  if (!mnemonic) {
    return NextResponse.json(
      {
        error: "MNEMONIC not configured",
        message: "Add FARCASTER_DEVELOPER_MNEMONIC to Vercel env variables",
      },
      { status: 500 }
    );
  }

  try {
    // Farcaster JSON Signatures (JFS):
    // signingInput = `${base64url(header)}.${base64url(payload)}`
    // signature = signMessage(signingInput) -> hex -> base64url

    const wallet = Wallet.fromPhrase(mnemonic.trim());
    const custodyAddress = await wallet.getAddress();

    const headerObj = {
      fid,
      type: "custody",
      key: custodyAddress,
    };

    const payloadObj = {
      domain,
    };

    const header = Buffer.from(JSON.stringify(headerObj), "utf-8").toString(
      "base64url"
    );
    const payload = Buffer.from(JSON.stringify(payloadObj), "utf-8").toString(
      "base64url"
    );

    const signingInput = `${header}.${payload}`;
    const sigHex = await wallet.signMessage(signingInput); // 0x...
    const signature = Buffer.from(sigHex.slice(2), "hex").toString("base64url");

    const manifest = {
      accountAssociation: {
        header,
        payload,
        signature,
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
        webhookUrl: `https://${domain}/api/webhook`,
      },
    };

    return NextResponse.json(manifest, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Frame manifest error:", error);
    return NextResponse.json(
      { error: "Failed to generate manifest" },
      { status: 500 }
    );
  }
}
