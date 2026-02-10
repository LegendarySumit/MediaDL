#!/bin/bash

# ==============================================
# Production Deployment Script
# ==============================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Media Downloader - Production Deploy${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}Error: backend/.env not found${NC}"
    echo "Copy .env.production to backend/.env and configure it:"
    echo "  cp .env.production backend/.env"
    echo "  nano backend/.env"
    exit 1
fi

# Check if domain is configured
DOMAIN=$(grep "^DOMAIN=" backend/.env | cut -d '=' -f2)
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "your-domain.com" ]; then
    echo -e "${RED}Error: DOMAIN not configured in backend/.env${NC}"
    echo "Edit backend/.env and set your domain name"
    exit 1
fi

echo -e "${YELLOW}Deploying to domain:${NC} $DOMAIN"
echo ""

# Pre-deployment checks
echo -e "${GREEN}Running pre-deployment checks...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker installed${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Check disk space (should have at least 10GB free)
FREE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
if [ "$FREE_SPACE" -lt 10 ]; then
    echo -e "${YELLOW}⚠ Warning: Low disk space (${FREE_SPACE}GB free)${NC}"
fi

echo ""

# Build and start services
echo -e "${GREEN}Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

echo ""
echo -e "${GREEN}Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo -e "${GREEN}Waiting for services to be healthy...${NC}"
sleep 10

# Check service health
REDIS_STATUS=$(docker-compose -f docker-compose.prod.yml ps redis | grep "Up" || echo "Down")
BACKEND_STATUS=$(docker-compose -f docker-compose.prod.yml ps backend | grep "Up" || echo "Down")
FRONTEND_STATUS=$(docker-compose -f docker-compose.prod.yml ps frontend | grep "Up" || echo "Down")
NGINX_STATUS=$(docker-compose -f docker-compose.prod.yml ps nginx | grep "Up" || echo "Down")

echo ""
echo -e "${GREEN}Service Status:${NC}"
if [[ $REDIS_STATUS == *"Up"* ]]; then
    echo -e "  Redis:    ${GREEN}✓ Running${NC}"
else
    echo -e "  Redis:    ${RED}✗ Down${NC}"
fi

if [[ $BACKEND_STATUS == *"Up"* ]]; then
    echo -e "  Backend:  ${GREEN}✓ Running${NC}"
else
    echo -e "  Backend:  ${RED}✗ Down${NC}"
fi

if [[ $FRONTEND_STATUS == *"Up"* ]]; then
    echo -e "  Frontend: ${GREEN}✓ Running${NC}"
else
    echo -e "  Frontend: ${RED}✗ Down${NC}"
fi

if [[ $NGINX_STATUS == *"Up"* ]]; then
    echo -e "  Nginx:    ${GREEN}✓ Running${NC}"
else
    echo -e "  Nginx:    ${RED}✗ Down${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete! 🚀${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Your application is available at:"
echo -e "  ${GREEN}http://$DOMAIN${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Set up SSL: ./setup-ssl.sh $DOMAIN your-email@example.com"
echo "  2. View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "  3. Monitor: docker-compose -f docker-compose.prod.yml ps"
echo ""
echo -e "${YELLOW}Management commands:${NC}"
echo "  Stop:    docker-compose -f docker-compose.prod.yml down"
echo "  Restart: docker-compose -f docker-compose.prod.yml restart"
echo "  Logs:    docker-compose -f docker-compose.prod.yml logs -f [service]"
echo ""
