import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// Inicializar Firebase Admin referenciando ADC 
try {
  initializeApp();
} catch (error) {
  console.log("Firebase Admin ya inicializado o error", error);
}

const adminDb = getFirestore();
const adminAuth = getAuth();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para JSON
  app.use(express.json());

  // Rutas de API básicas
  app.get("/api/health", (req, res) => {
    res.json({ status: "Nexus Online", timestamp: new Date().toISOString() });
  });

  // Registro con verificación por enlace
  app.post('/api/auth/register', async (req, res) => {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });

    try {
      // 1. Crear el usuario en Firebase Auth (esto maneja la contraseña de forma segura) 
      let uid;
      try {
        const userRecord = await adminAuth.createUser({ 
          email, 
          password,
          displayName: displayName || email.split('@')[0]
        });
        uid = userRecord.uid;
      } catch (error: any) {
        if (error.code === 'auth/email-already-exists') {
           return res.status(400).json({ error: "El correo ya está registrado" });
        }
        throw error;
      }

      // 2. Crear el usuario en Firestore en estado "No verificado"
      await adminDb.collection('users').doc(uid).set({
        email: email,
        displayName: displayName || email.split('@')[0],
        username: email.split('@')[0].toLowerCase() + Math.floor(Math.random()*1000),
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
        isVerified: false,
        createdAt: Timestamp.now()
      });

      // 3. Generar un token criptográfico seguro de 32 bytes en formato hexadecimal
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // 4. Guardar el token en Firestore
      await adminDb.collection('verification_tokens').doc(verificationToken).set({
        uid: uid,
        email: email,
        createdAt: Timestamp.now()
      });

      // 5. Enviar el correo con el enlace
      const protocol = req.protocol === 'http' && req.get('host')?.includes('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${req.get('host')}`;
      const verificationLink = `${baseUrl}/api/auth/verify/${verificationToken}`;
      
      const mailOptions = {
        from: `"Bienvenida Nexus" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Activa tu cuenta de Nexus',
        html: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h2>¡Gracias por registrarte!</h2>
            <p>Para empezar a publicar y conectar, por favor confirma tu correo electrónico haciendo clic en el siguiente botón:</p>
            <a href="${verificationLink}" style="background-color: #007BFF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">
              Activar mi cuenta
            </a>
            <p style="color: #888; font-size: 12px; margin-top: 20px;">Si el botón no funciona, copia y pega este enlace en tu navegador: <br> ${verificationLink}</p>
          </div>
        `
      };

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail(mailOptions);
        console.log(`Correo enviado a ${email}`);
      } else {
        console.log("⚠️ EMAIL_USER no configurado. Token generado:", verificationLink);
      }

      res.status(201).json({ 
        message: "Usuario registrado. Por favor revisa tu correo para activar la cuenta." 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error en el registro" });
    }
  });

  // Verificación al hacer clic en el enlace
  app.get('/api/auth/verify/:token', async (req, res) => {
    const { token } = req.params;
    const protocol = req.protocol === 'http' && req.get('host')?.includes('localhost') ? 'http' : 'https';
    const FRONTEND_URL = `${protocol}://${req.get('host')}`;
    
    try {
      // 1. Buscar el token en Firestore
      const tokenDoc = await adminDb.collection('verification_tokens').doc(token).get();
      
      if (!tokenDoc.exists) {
        return res.redirect(`${FRONTEND_URL}/?error=invalid_token`); 
      }

      const { uid } = tokenDoc.data() || {};

      // 2. Actualizar el estado del usuario en Firestore a verificado
      await adminDb.collection('users').doc(uid).update({
        isVerified: true
      });

      // 3. Opcionalmente marcar el correo como verificado en Firebase Auth
      await adminAuth.updateUser(uid, {
        emailVerified: true
      });

      // 4. Eliminar el token
      await adminDb.collection('verification_tokens').doc(token).delete();

      // 5. GENERAR LA SESIÓN INMEDIATA (Custom Token de Firebase)
      const sessionToken = await adminAuth.createCustomToken(uid);

      // 6. Redirigir al frontend pasando el token en la URL
      res.redirect(`${FRONTEND_URL}/?verified=true&token=${sessionToken}`);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error interno del servidor al verificar la cuenta.");
    }
  });

  // Configuración de Vite como middleware para desarrollo
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nexus] Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
