#!/bin/bash

# Media Downloader - Let's Encrypt SSL Setup Script
# Run this on your Linux server to get FREE SSL certificates

set -e

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║   Media Downloader - Let's Encrypt SSL Setup                           ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
   echo "❌ Please run this script as root (use: sudo ./setup-ssl.sh)"
   exit 1
fi

# Get domain from user
read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN
read -p "Enter your email for Let's Encrypt notifications: " EMAIL

if [ -z "$DOMAIN" ]; then
    echo "❌ Domain name is required"
    exit 1
fi

echo ""
echo "Setting up SSL for: $DOMAIN"
echo ""

# Update system
echo "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# Install Certbot (Let's Encrypt client)
echo "Installing Certbot..."
apt-get install -y -qq certbot python3-certbot-nginx

# Create SSL directory
echo "Creating SSL directory..."
mkdir -p /home/media-downloader/nginx/ssl

# Get certificate using standalone mode (no web server required yet)
echo ""
echo "⏳ Getting SSL certificate from Let's Encrypt..."
echo "   (This may take a minute...)"
echo ""

certbot certonly \
    --standalone \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --quiet

# Copy certificates to app directory
echo ""
echo "Copying certificates..."
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /home/media-downloader/nginx/ssl/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /home/media-downloader/nginx/ssl/

# Set permissions
chmod 644 /home/media-downloader/nginx/ssl/fullchain.pem
chmod 600 /home/media-downloader/nginx/ssl/privkey.pem

# Create auto-renewal script
echo ""
echo "Setting up auto-renewal..."
cat > /etc/cron.d/certbot-renew << EOF
# Let's Encrypt certificate auto-renewal
0 3 * * * root certbot renew --quiet && \
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /home/media-downloader/nginx/ssl/ && \
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /home/media-downloader/nginx/ssl/ && \
    docker ps | grep media-downloader-nginx && docker exec media-downloader-nginx nginx -s reload
EOF

echo "✅ Auto-renewal scheduled (runs daily at 3 AM)"

echo ""
echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║                        ✅ SUCCESS!                                    ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "SSL Certificates installed:"
echo "  • Fullchain: /home/media-downloader/nginx/ssl/fullchain.pem"
echo "  • Private Key: /home/media-downloader/nginx/ssl/privkey.pem"
echo ""
echo "Next steps:"
echo "  1. Update nginx/nginx.production.conf with your domain name"
echo "  2. Run: docker-compose -f docker-compose.production.yml up -d"
echo "  3. Test: curl https://$DOMAIN"
echo ""
echo "Auto-renewal: Enabled (runs daily at 3 AM)"
echo ""
