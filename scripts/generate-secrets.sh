#!/bin/bash

# Script to generate secure secrets for production environment

echo "Generating secure secrets for Omni One production..."

# Generate 32-byte hex strings
JWT_SECRET=$(openssl rand -hex 32)
COOKIE_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 24)

# Generate exactly 32-character string for encryption key
ENCRYPTION_KEY=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)

echo "----------------------------------------"
echo "JWT_SECRET=$JWT_SECRET"
echo "COOKIE_SECRET=$COOKIE_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "POSTGRES_PASSWORD=$DB_PASSWORD"
echo "----------------------------------------"
echo "Copy these values into your .env.production file."
