import { Router } from 'express';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';

const router = Router();

// PING (Um Server-Verfügbarkeit zu prüfen)
router.get('/ping', (req, res) => {
  res.json({ status: 'ok', server: 'CloverTalk Server', version: '1.0.0' });
});

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check ob User existiert
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email bereits vergeben" });

    const user = await User.create({ username, email, password_hash: password });
    
    res.json({ message: "Erfolgreich registriert", userId: user.id });
  } catch (err) {
    res.status(500).json({ error: "Fehler bei der Registrierung" });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await user.checkPassword(password))) {
      return res.status(401).json({ error: "Ungültige Daten" });
    }

    // Token erstellen (damit der Client eingeloggt bleibt)
    const token = jwt.sign({ id: user.id, username: user.username }, 'SECRET_KEY_HIER_AENDERN', { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar_url } });
  } catch (err) {
    res.status(500).json({ error: "Login fehlgeschlagen" });
  }
});

export default router;