export default function handler(req, res) {
  const baseUrl = 'https://farbase-grid.vercel.app';
  
  if (req.method === 'POST') {
    const { buttonIndex } = req.body;
    
    if (buttonIndex === 1) {
      return res.redirect(302, `${baseUrl}/?mode=practice`);
    }
    else if (buttonIndex === 2) {
      return res.redirect(302, `${baseUrl}/?mode=tournament`);
    }
    else if (buttonIndex === 3) {
      return res.redirect(302, `${baseUrl}/?view=leaderboard`);
    }
  }
  
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${baseUrl}/preview.png" />
        <meta property="fc:frame:button:1" content="🎮 Practice" />
        <meta property="fc:frame:button:2" content="🏆 Tournament (1 USDC)" />
        <meta property="fc:frame:button:3" content="📊 Leaderboard" />
        <meta property="fc:frame:post_url" content="${baseUrl}/api/frame" />
      </head>
    </html>
  `);
}
