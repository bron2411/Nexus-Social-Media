export default function handler(req: any, res: any) {
  res.status(200).json({
    status: "Nexus Online",
    timestamp: new Date().toISOString(),
    platform: "Vercel Serverless"
  });
}
