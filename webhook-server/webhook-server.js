import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const PORT = 3000;
app.use(express.json());
app.get('/webhook/status', (req, res) => {
  res.json({status: 'running', port: PORT, uptime: process.uptime()});
});
app.post('/webhook/push', (req, res) => {
  console.log('Push webhook received:', req.body);
  res.json({status: 'received'});
});
app.get('/webhook/logs', (req, res) => {
  res.json({logs: []});
});
app.listen(PORT, () => {
  console.log('Webhook Server Running on port 3000');
  console.log('Status: http://localhost:3000/webhook/status');
});
