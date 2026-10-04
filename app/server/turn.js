const cloudflareTurnUrl = (tokenId) => `https://rtc.live.cloudflare.com/v1/turn/keys/${tokenId}/credentials/generate-ice-servers`;

export function cloudflareTurnPlugin() {
  return {
    name: 'cloudflare-turn-credentials',
    configureServer(server) {
      server.middlewares.use('/api/turn-ice-servers', async (request, response, next) => {
        if (request.method !== 'GET') {
          response.statusCode = 405;
          response.setHeader('Allow', 'GET');
          response.end('Method Not Allowed');
          return;
        }

        const tokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID;
        const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
        if (!tokenId || !apiToken) {
          response.statusCode = 503;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: 'Cloudflare TURN credentials are not configured.' }));
          return;
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
          response.statusCode = cloudflareResponse.status;
          response.setHeader('Content-Type', 'application/json');
          response.end(body);
        } catch (error) {
          console.error('Cloudflare TURN credential request failed:', error);
          response.statusCode = 502;
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ error: 'Unable to get TURN credentials.' }));
        }
      });
    },
  };
}
