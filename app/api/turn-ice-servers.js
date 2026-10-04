const cloudflareTurnUrl = (tokenId) => `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`;

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).send('Method Not Allowed');
  }

  const tokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!tokenId || !apiToken) {
    return response.status(503).json({ error: 'Cloudflare TURN credentials are not configured.' });
  }

  try {
    const cloudflareResponse = await fetch(cloudflareTurnUrl(tokenId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 3600 }),
    });

    const body = await cloudflareResponse.text();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json');
    return response.status(cloudflareResponse.status).send(body);
  } catch (error) {
    console.error('Cloudflare TURN credential request failed:', error);
    return response.status(502).json({ error: 'Unable to get TURN credentials.' });
  }
}
