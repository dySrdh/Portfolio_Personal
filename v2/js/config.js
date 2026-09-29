// Firebase project the portfolio reads from (Firebase Console → Project settings → General → Your apps → Web app).
// These values are public by design; the Firestore rules only allow reading.
export const FIREBASE = {
  projectId: 'portfolio-1f4eb',
  apiKey: 'AIzaSyBSysQyC2EPhHQmN2OmLlYYoGspqNz06vs'
};

// ElevenLabs agents behind the Oracle, one per language (written by v2/story/create-agents.mjs). Public agents need no key here.
export const ELEVENLABS = {
  agentIdEn: 'agent_9401m3mg8p0hfg4v7jfvzjmn5krt',
  agentIdId: 'agent_9101m3mgbk8rf6vb60mm5j69922k'
};

// Backup Oracle: Gemini through Firebase AI Logic (no-cost tier), used when ElevenLabs is unset, fails or runs out.
// Enable it once in Firebase Console → AI Logic → Get started → Gemini Developer API.
export const GEMINI = {
  enabled: true,
  liveModel: 'gemini-2.5-flash-native-audio-preview-12-2025', // voice calls
  textModel: 'gemini-3.5-flash-lite',                         // typed questions
  voice: 'Puck',                                             // prebuilt Gemini voice
  appId: '1:830265132954:web:fc024c6e9c5b6e86b71c23',            // Firebase web app id (Project settings → Your apps) — needed for App Check
  recaptchaSiteKey: ''  // App Check (reCAPTCHA v3) site key — required by Firebase from 2 Nov 2026
};
