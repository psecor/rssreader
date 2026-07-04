import express from 'express';

const router = express.Router();

// Webhook stubs — real signature verification and receipt validation land in
// Phase B (Play Real-time Developer Notifications) and Phase C (App Store
// Server Notifications V2). For now these just log the payload so we can eyeball
// what Google/Apple actually send during testing.

router.post('/play', (req, res) => {
  console.log('[webhook:play]', JSON.stringify(req.body));
  res.status(200).json({ received: true });
});

router.post('/apple', (req, res) => {
  console.log('[webhook:apple]', JSON.stringify(req.body));
  res.status(200).json({ received: true });
});

export default router;
