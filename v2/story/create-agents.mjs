// Creates (or updates) the two ElevenLabs Oracle agents — English and Indonesian — with their voices,
// prompts, knowledge base and security settings, then writes their IDs into ../js/config.js.
// Re-run after editing agent-prompt.md or rebuilding knowledge-base.md (node build-knowledge.mjs).
//
// Usage (inside v2/story):  node create-agents.mjs --key-file="C:\path\to\elevenlabs.txt"
//   or put ELEVENLABS_API_KEY=... in v2/story/.env
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').slice(k.length + 3).replace(/^"|"$/g, '');

// ---- API key: --key-file, env, or .env (never printed)
let KEY = process.env.ELEVENLABS_API_KEY;
if (arg('key-file')) KEY = (readFileSync(arg('key-file'), 'utf8').match(/sk_[A-Za-z0-9]+/) || [readFileSync(arg('key-file'), 'utf8').trim()])[0];
if (!KEY && existsSync(new URL('.env', here))) KEY = (readFileSync(new URL('.env', here), 'utf8').match(/ELEVENLABS_API_KEY\s*=\s*["']?([^"'\s]+)/) || [])[1];
if (!KEY) { console.error('No ElevenLabs API key (use --key-file or v2/story/.env)'); process.exit(1); }

async function el(path, init = {}) {
  const r = await fetch('https://api.elevenlabs.io' + path, { ...init, headers: { 'xi-api-key': KEY, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch (e) { body = text; }
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${path} → ${r.status} ${JSON.stringify(body).slice(0, 500)}`);
  return body;
}

// ---- voices: shared-library voices are added to the account once (free plan: 3 slots)
const VOICES = {
  agentEn: { id: 'UgBBYS2sOqTuMpoF3BR0', name: 'Mark - Natural Conversations', lang: 'en' },
  agentId: { id: 'lFjzhZHq0NwTRiu2GQxy', name: 'Tri Nugraha - Friendly and Inviting', lang: 'id' },
  narratorId: { id: 'RWiGLY9uXI70QL540WNd', name: 'Putra - Smooth, Clear and Engaging', lang: 'id' }
};
const mine = (await el('/v1/voices')).voices;
for (const [k, v] of Object.entries(VOICES)) {
  const have = mine.find(m => m.voice_id === v.id || m.name === v.name);
  if (have) { v.id = have.voice_id; console.log(`voice ✓ ${v.name} (already added)`); continue; }
  const found = (await el(`/v1/shared-voices?page_size=100&language=${v.lang}&search=${encodeURIComponent(v.name.split(' - ')[0])}`)).voices.find(x => x.voice_id === v.id);
  if (!found) throw new Error('Shared voice not found: ' + v.name);
  const added = await el(`/v1/voices/add/${found.public_owner_id}/${found.voice_id}`, { method: 'POST', body: JSON.stringify({ new_name: v.name }) });
  v.id = added.voice_id;
  console.log(`voice + ${v.name}`);
}

// ---- prompts from agent-prompt.md
const md = readFileSync(new URL('agent-prompt.md', here), 'utf8');
const section = title => {
  const s = md.split(/^## /m).find(x => x.startsWith(title));
  const body = s.slice(title.length).trim();
  const first = body.match(/^(?:First message|Pesan pertama):\s*(.+)$/m)[1].trim();
  return { prompt: body.replace(/^(?:First message|Pesan pertama):.*$/m, '').trim(), first };
};

// ---- knowledge base (whole document goes into the prompt: small enough, better recall than RAG)
const kbText = readFileSync(new URL('knowledge-base.md', here), 'utf8');
const state = existsSync(new URL('agents.json', here)) ? JSON.parse(readFileSync(new URL('agents.json', here), 'utf8')) : {};
state.voices = Object.fromEntries(Object.entries(VOICES).map(([k, v]) => [k, v.id]));
const kbHash = String(kbText.length) + ':' + [...kbText].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
const KB_NAME = 'Doddy Suryadharma — portfolio';
if (!state.kb) {
  const existing = ((await el('/v1/convai/knowledge-base?page_size=100')).documents || []).find(d => d.name === KB_NAME);
  if (existing) state.kb = { id: existing.id, name: KB_NAME, hash: null };
}
if (!state.kb || state.kb.hash !== kbHash) {
  const doc = await el('/v1/convai/knowledge-base/text', { method: 'POST', body: JSON.stringify({ text: kbText, name: KB_NAME }) });
  state.kb = { id: doc.id, name: KB_NAME, hash: kbHash };
  save();
  console.log('knowledge base uploaded');
} else console.log('knowledge base ✓ unchanged');

function save() { writeFileSync(new URL('agents.json', here), JSON.stringify(state, null, 2) + '\n'); }
const existingAgents = ((await el('/v1/convai/agents?page_size=100')).agents || []);

const allowlist = ['localhost', '127.0.0.1', 'dysrdh.github.io', 'suryadharma-dy-portfolio.vercel.app', ...(arg('domains') ? arg('domains').split(',') : [])].map(hostname => ({ hostname }));

function agentBody(lang, name, voiceId, tts) {
  const { prompt, first } = section(lang === 'en' ? 'English agent' : 'Indonesian agent');
  return {
    name,
    conversation_config: {
      agent: {
        first_message: first,
        language: lang,
        prompt: { prompt, llm: 'gemini-2.5-flash', temperature: 0.5, knowledge_base: [{ type: 'text', name: state.kb.name, id: state.kb.id, usage_mode: 'prompt' }] }
      },
      tts: { voice_id: voiceId, model_id: tts, stability: 0.45, similarity_boost: 0.8, speed: 1.0 },
      conversation: { max_duration_seconds: 300 }, // one visitor can't drain the monthly minutes
      turn: { turn_timeout: 8, silence_end_call_timeout: 20 } // hang up after 20 s of silence
    },
    platform_settings: {
      overrides: { conversation_config_override: { agent: { first_message: true, language: true }, conversation: { text_only: true } } },
      auth: { enable_auth: false, allowlist }
    }
  };
}

async function upsert(key, lang, name, voiceId) {
  if (!state[key]) { const found = existingAgents.find(a => a.name === name); if (found) state[key] = found.agent_id; }
  let lastError = '';
  for (const tts of ['eleven_v3_conversational', 'eleven_flash_v2_5']) {
    for (const llm of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
      const body = agentBody(lang, name, voiceId, tts);
      body.conversation_config.agent.prompt.llm = llm;
      try {
        if (state[key]) await el(`/v1/convai/agents/${state[key]}`, { method: 'PATCH', body: JSON.stringify(body) });
        else state[key] = (await el('/v1/convai/agents/create', { method: 'POST', body: JSON.stringify(body) })).agent_id;
        console.log(`agent ✓ ${name} → ${state[key]}  (voice model ${tts}, llm ${llm})`);
        save();
        return;
      } catch (e) {
        if (!/model|llm|tts|not (supported|allowed|available)|invalid/i.test(e.message)) throw e;
        lastError = e.message;
        console.log(`  … ${tts} / ${llm} not accepted: ${e.message.slice(0, 220)}`);
      }
    }
  }
  throw new Error(`Could not create ${name}: ${lastError}`);
}
await upsert('en', 'en', "Doddy's AI — English", VOICES.agentEn.id);
await upsert('id', 'id', "Doddy's AI — Indonesia", VOICES.agentId.id);
state.voices = Object.fromEntries(Object.entries(VOICES).map(([k, v]) => [k, v.id]));
save();

// ---- write agent IDs into the site config
const cfgUrl = new URL('../js/config.js', import.meta.url);
const cfg = readFileSync(cfgUrl, 'utf8').replace(/export const ELEVENLABS = \{[\s\S]*?\n\};/,
  `export const ELEVENLABS = {\n  agentIdEn: '${state.en}',\n  agentIdId: '${state.id}'\n};`);
writeFileSync(cfgUrl, cfg);
console.log('\nconfig.js updated with both agent IDs.');
