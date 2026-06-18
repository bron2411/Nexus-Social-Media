import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

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

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para JSON
  app.use(express.json());

  // Rutas de API básicas
  app.get("/api/health", (req, res) => {
    res.json({ status: "Nexus Online", timestamp: new Date().toISOString() });
  });

  // OTP Auth Rutas
  app.post('/api/auth/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email requerido" });

    const otp = generateOTP();
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));

    try {
      await adminDb.collection('verification_codes').doc(email).set({
        otp: otp,
        expiresAt: expiresAt
      });

      const mailOptions = {
        from: `"Nexus" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Tu código de verificación Nexus',
        html: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h2>Código de Verificación</h2>
            <p>Usa el siguiente código de 6 dígitos para ingresar a Nexus. Este código expirará en 10 minutos.</p>
            <div style="font-size: 24px; font-weight: bold; background-color: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px; letter-spacing: 5px;">
              ${otp}
            </div>
          </div>
        `
      };

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail(mailOptions);
      } else {
        console.log("⚠️ EMAIL_USER y EMAIL_PASS no configurados. OTP generado de prueba:", otp);
      }
      
      res.status(200).json({ message: "Código enviado" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error al procesar la solicitud" });
    }
  });

  app.post('/api/auth/verify-code', async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Datos incompletos" });

    try {
      const docSnap = await adminDb.collection('verification_codes').doc(email).get();
      if (!docSnap.exists) return res.status(400).json({ error: "No hay código pendiente" });

      const data = docSnap.data();

      if (Date.now() > data?.expiresAt?.toMillis()) {
        return res.status(400).json({ error: "El código ha expirado" });
      }

      if (data?.otp !== code) {
        return res.status(400).json({ error: "Código incorrecto" });
      }

      await adminDb.collection('verification_codes').doc(email).delete();

      let uid;
      try {
        const userRecord = await adminAuth.getUserByEmail(email);
        uid = userRecord.uid;
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          const newUser = await adminAuth.createUser({ email });
          uid = newUser.uid;
        } else {
          throw error;
        }
      }

      const token = await adminAuth.createCustomToken(uid);
      res.status(200).json({ message: "Identidad confirmada", token });

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error de servidor" });
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
