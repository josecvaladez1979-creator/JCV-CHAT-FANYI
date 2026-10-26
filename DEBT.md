1. Inventario y Arquitectura (Fase Cero)
Implementado y Verificado:
Configuración básica de Express (CORS, Helmet, Rate Limiting).
Modelos de User, Organization, SubscriptionB2B, SubscriptionB2C y Message en schema.prisma.
Frontend modular en React/Vite.
Declarado en Frontend pero Ausente en Backend:
El frontend (src/services/api.ts) hace llamadas a rutas que no existen en server.ts, como:
/api/chat/messages (envío de mensajes y validación de cuota).
/api/chat/channels (creación y consulta de canales).
/api/webrtc/signal (señalización para llamadas).
/api/vault/* (bóveda de documentos).
/api/auth/users (listado de usuarios para inicio de sesión simulado).
Riesgo Crítico: Al no existir estas rutas en el backend, la aplicación frontend fallará con errores 404 Not Found en la mayoría de sus operaciones principales.
2. Chat Gratuito y Modalidad Freemium
Hallazgo: La intención de limitar a 10 mensajes y 500 caracteres existe en el backend, pero provoca un fallo crítico.
Evidencia: En server.ts#L999-L1007 se utiliza FREEMIUM_LIMIT.messagesPerDay.
Riesgo: La constante FREEMIUM_LIMIT no está definida ni importada en ninguna parte del archivo. Si un usuario hace una petición a /api/freemium/limits, el servidor se caerá inmediatamente con un ReferenceError.
Ausencia: Además, no hay código en el backend que bloquee o cuente los mensajes reales porque la ruta /api/chat/messages no existe.
3. Créditos B2C (100, 200 y 500)
Hallazgo: El sistema de recargas de IA no está integrado en la base de datos y la ruta del backend está rota.
Evidencia 1: En server.ts#L660-L671, la ruta /api/ai-wallet/topups intenta devolver Object.values(AI_WALLET_TOPUPS).
Riesgo: La constante AI_WALLET_TOPUPS no está definida ni importada. Esto provocará otro ReferenceError y caída del servidor.
Evidencia 2: Al revisar schema.prisma, no existen modelos para Wallet, Credit, o transacciones de recargas. Si se procesa un pago, no hay un lugar estructurado donde sumar los créditos del usuario.
4. Planes B2B (BASIC, PROFESSIONAL, CORPORATE)
Hallazgo: Los planes están correctamente definidos y aprobados en server.ts#L678-L700 (BASIC a 599 MXN, PROFESSIONAL a 999 MXN, CORPORATE a 2099 MXN).
Riesgo en Validación Checkout: En server.ts#L742-L803, la ruta /api/b2b/checkout/validate invoca getB2BTier(req.body?.tierId). La función getB2BTier no está declarada. Además, esta ruta devuelve engañosamente checkoutReady: true sin haber creado una sesión real en Stripe.
5. Planes B2C
Hallazgo: Los identificadores B2C_15D, B2C_1M y B2C_1Y siguen existiendo tanto en schema.prisma.
Riesgo Crítico: En server.ts#L621-L636, la ruta /api/b2c/plans usa B2C_PLANS. Al igual que los casos anteriores, esta constante no se importa ni se declara en el backend, lo que tirará el servidor.
6. Pasarelas de Pago y Webhooks
Hallazgo: Existen comprobaciones de variables de entorno para Stripe, PayPal y Mercado Pago, pero no hay implementación de cobro real.
Ausencia: No existe ninguna ruta de webhook (/api/webhooks/stripe, etc.). Si un usuario paga, el servidor nunca se enterará, no validará la firma de seguridad (evitando fraude), ni activará suscripciones o acreditará saldos en Prisma.
7. Otros Errores de Estabilidad en Backend
La función de autenticación invoca setRefreshCookie(res, refreshToken) en los inicios y registros de sesión (server.ts#L359), pero la función no existe en el archivo. Esto impide que cualquier usuario pueda iniciar sesión.
PLAN DE CORRECCIÓN PROPUESTO (Requiere Autorización)
Debido a que el servidor actual colapsaría al intentar ejecutar acciones básicas de autenticación o consultar planes, propongo el siguiente plan de acción estructurado. Por favor, autoriza explícitamente con qué paso deseas que comience:

Paso 1: Estabilización Crítica de server.ts
Riesgo a corregir: Caída del servidor (ReferenceError).
Acción: Importar y definir correctamente B2C_PLANS, AI_WALLET_TOPUPS, FREEMIUM_LIMIT, implementar la función setRefreshCookie y getB2BTier.
Paso 2: Arquitectura de Base de Datos (Créditos IA)
Riesgo a corregir: Falta de trazabilidad en compras de IA.
Acción: Añadir a schema.prisma los modelos Wallet (saldo del usuario) y CreditTransaction (historial inmutable de compras/consumos).
Paso 3: Rutas de Mensajería y Freemium
Riesgo a corregir: Frontend desconectado y límites no aplicados.
Acción: Crear las rutas reales /api/chat/messages y /api/chat/channels en server.ts aplicando la validación de la cuota Freemium contra Prisma.
Paso 4: Pagos y Webhooks Seguros (Stripe)
Riesgo a corregir: Imposibilidad de monetización y alto riesgo de vulneración de saldos desde el frontend.
Acción: Reemplazar la falsa validación B2B por la creación de Stripe Checkout Sessions e implementar /api/webhooks/stripe con validación criptográfica estricta.

1. Seguridad y Autenticación (Crítico)
Sistema de Autenticación Roto en Backend:
Las funciones setRefreshCookie y clearRefreshCookie son invocadas en múltiples rutas críticas del servidor (registro, login, logout), pero no están definidas ni importadas en el archivo. Esto provocará un ReferenceError y el colapso del servidor en cada intento de inicio de sesión o registro.
Evidencia: Llamadas inexistentes en server.ts:L359-560.
Ausencia de Contraseñas en el Frontend:
El backend exige y valida estrictamente una contraseña a través de req.body.password y la compara con bcrypt para autenticar a los usuarios. Sin embargo, el componente de la interfaz de usuario no incluye ningún campo de entrada para contraseñas.
Evidencia: Ausencia de inputs tipo password en el formulario de AuthModal.tsx frente a la validación estricta en server.ts:L397.
Almacenamiento Inseguro de Tokens (JWT):
El token de acceso principal se almacena directamente en el localStorage del navegador, lo que expone las sesiones de los usuarios a ataques de Cross-Site Scripting (XSS).
Evidencia: Uso de localStorage.setItem(TOKEN_KEY, token) en api.ts:L15.
Debilidades en la Criptografía E2EE:
La huella de seguridad (Safety Fingerprint) se genera haciendo un hash simple de la frase de contraseña (passphrase), sin usar un salt ni vincularlo a una clave pública. Esto permite colisiones exactas si dos usuarios eligen la misma frase. Además, la derivación PBKDF2 usa 100,000 iteraciones, lo cual está por debajo de las 600,000 recomendadas por OWASP.
Evidencia: Función computeSafetyFingerprint en crypto.ts:L118 e iteraciones en crypto.ts:L20.
2. Arquitectura y Lógica de Negocio
Gestión de Cuotas Vulnerable (Lado del Cliente):
El control de límites de traducciones y minutos de llamadas se gestiona de manera íntegra en el navegador mediante localStorage. Cualquier usuario puede eludir las restricciones de los planes de pago borrando su caché o modificando la variable jcv_quota_ manualmente.
Evidencia: Funciones getStoredQuota e incrementTranslationQuota en quota.ts:L135-L277.
Modelos de Base de Datos Huérfanos:
El esquema de Prisma define un modelo RefreshToken, pero el servidor nunca persiste los tokens emitidos en la base de datos, lo que imposibilita revocar las sesiones activas en caso de compromiso de cuenta.
Evidencia: Modelo definido en schema.prisma:L106 que no tiene uso en el servidor.
Planes y Precios Hardcodeados:
Toda la configuración comercial, incluyendo precios y límites, está codificada de forma rígida y duplicada en múltiples archivos en lugar de ser consultada desde la base de datos, dificultando el mantenimiento.
Evidencia: Constantes en plans.ts:L7 y quota.ts:L51.
3. Calidad del Código
Errores de Sintaxis que Impiden la Compilación:
Existen errores de comillas sin cerrar en la definición de monedas que romperán el transpilador de TypeScript/Vite al momento de construir la aplicación.
Evidencia: Comillas faltantes en plans.ts:L34 y plans.ts:L55 (currency: 'MXN,).
Informe de Correcciones Propuestas (Plan de Acción)
Si decides autorizar los cambios, sugiero implementar las siguientes soluciones en este orden de prioridad:

Reparar la Autenticación Base (Crítico):
Implementar las funciones faltantes setRefreshCookie y clearRefreshCookie en el servidor usando cookies seguras (HttpOnly, Secure, SameSite=Strict).
Agregar el campo de contraseña al formulario de inicio de sesión y registro en el frontend (AuthModal.tsx).
Migrar Cuotas al Servidor (Alta):
Eliminar la dependencia de localStorage en quota.ts y trasladar toda la lógica de validación e incremento al backend, almacenando el uso real en la base de datos (Prisma).
Mejorar la Seguridad de Tokens y E2EE (Media):
Aumentar las iteraciones PBKDF2 a 600,000 en crypto.ts.
Modificar la generación del "Safety Fingerprint" para incluir un vector de inicialización único (Salt) por usuario.
Refactorizar el almacenamiento del JWT para que transite hacia cookies seguras, o mitigarlo con tiempos de expiración muy cortos acoplados al Refresh Token.
Resolver Deuda Técnica (Media):
Corregir el error de sintaxis en plans.ts.
Implementar la persistencia real del RefreshToken en la base de datos para permitir la revocación de sesiones.



