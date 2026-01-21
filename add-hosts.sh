#!/bin/bash
# Script para agregar dominios locales al archivo /etc/hosts

echo "Agregando rcsa.local y oak.local a /etc/hosts..."

# Verificar si ya existen
if grep -q "rcsa.local" /etc/hosts 2>/dev/null; then
    echo "⚠️  rcsa.local ya existe en /etc/hosts"
else
    echo "127.0.0.1   rcsa.local" | sudo tee -a /etc/hosts > /dev/null
    echo "✅ rcsa.local agregado"
fi

if grep -q "oak.local" /etc/hosts 2>/dev/null; then
    echo "⚠️  oak.local ya existe en /etc/hosts"
else
    echo "127.0.0.1   oak.local" | sudo tee -a /etc/hosts > /dev/null
    echo "✅ oak.local agregado"
fi

echo ""
echo "✅ Configuración completada!"
echo "Ahora puedes usar:"
echo "  - http://rcsa.local:4000"
echo "  - http://oak.local:4000"


