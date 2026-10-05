<div align="center">

# 🌐 JCV CHAT FĀNYÌ

### Chat de traducción neuronal en tiempo real con IA

[![CI/CD](https://github.com/josecvaladez1979-creator/JCV-CHAT-FANYI/actions/workflows/deploy.yml/badge.svg)](https://github.com/josecvaladez1979-creator/JCV-CHAT-FANYI/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node-20+-339933.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2d3748.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**Traducción 99% precisa · Cifrado E2EE · WebRTC · 12 idiomas · Stripe + PayPal + Mercado Pago**

[Demo](#-demo) · [Instalación](#-instalación-rápida) · [Arquitectura](#-arquitectura) · [Deploy](#-despliegue)

</div>

---

## ✨ Características

### 🔤 Traducción neuronal en tiempo real
- **Motor Qwen3-32B** vía SiliconFlow con fallback a **Gemini 2.5 Flash**
- **12 idiomas soportados**: Español (MX), Inglés, Chino, Japonés, Francés, Alemán, Portugués, Italiano, Ruso, Coreano, Árabe, Hindi
- **Traducción de audio** con Qwen2-Audio-7B-Instruct
- **Cifrado E2EE AES-256-GCM** para canales sensibles

### 💬 Comunicación unificada
- **Chat en tiempo real** con Server-Sent Events (SSE)
- **Llamadas de voz y video** vía WebRTC con SFrame
- **Mensajes con reacciones**, indicador de escritura, menciones
- **Canales públicos, privados y ultra-seguros (E2EE)**

### 💳 Monetización profesional
- **Freemium**: 20 traducciones/día, máx 500 caracteres
- **Planes B2C**: 15 días, 1 mes, 1 año (individuales)
- **Planes B2B**: 15 días, 1 mes, 1 año (empresariales con seats)
- **3 gateways integrados**: Stripe, PayPal, Mercado Pago
- **Webhooks reales** con idempotencia y verificación de firma

### 🏢 JCV FĀNYÌ VAULT (B2B)
- Traducción jurídica certificada de contratos transfronterizos
- Timer de autodestrucción (30m → 3h) con purga criptográfica
- Hash SHA-256 + certificado probatorio
- Facturación CFDI México + IVA incluido

---

## 🏗️ Arquitectura
