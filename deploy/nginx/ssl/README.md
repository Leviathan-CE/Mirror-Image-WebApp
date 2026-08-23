# Origin TLS certs (optional)

By default the production stack serves **HTTP on port 80** only. That works with Cloudflare **Flexible** SSL (visitors get HTTPS; Cloudflare talks HTTP to your VPS).

For Cloudflare **Full (strict)**, install a free **Origin Certificate**:

1. Cloudflare dashboard → your domain → **SSL/TLS** → **Origin Server**
2. **Create Certificate** (RSA, hostnames: `mirrorimagetcg.net`, `*.mirrorimagetcg.net`, `api.mirrorimagetcg.net` or use wildcard)
3. Save the certificate as `origin.pem` and private key as `origin.key` in **this folder** on the VPS
4. Set Cloudflare **SSL/TLS → Overview** to **Full (strict)**
5. Redeploy or restart nginx:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
   ```

**Never commit `origin.pem` or `origin.key`.** They are gitignored.
