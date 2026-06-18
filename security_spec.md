# Nexus Security Specification

## 1. Data Invariants
- Un Post no puede existir sin un `authorId` válido que coincida con el usuario autenticado.
- Un mensaje de Chat debe pertenecer a un hilos (`chatId`) en el que el usuario participe.
- El `username` es inmutable una vez creado para evitar confusión de identidad.

## 2. The "Dirty Dozen" (Payloads de Ataque)
- **Ataque 1 (Spoofing):** Intentar crear un post con el `authorId` de otro usuario.
- **Ataque 2 (Shadow Fields):** Intentar añadir `isAdmin: true` a un perfil de usuario.
- **Ataque 3 (ID Poisoning):** Usar un ID de 2MB para intentar ataques de denegación de cartera.
- **Ataque 4 (Temporal Bypass):** Enviar un `createdAt` del futuro o pasado manual.

## 3. Test Runner (Conceptual)
Se verificará que cada uno de estos payloads retorne `PERMISSION_DENIED` mediante nuestras reglas de validación estricta.
