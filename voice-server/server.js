import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SOPHIE_SYSTEM = `You are Sophie, a warm, knowledgeable, and capable AI concierge for CrystalClearHouse — a premium service platform.

Your personality:
- Warm and conversational, never robotic
- Confident and helpful, always solution-oriented
- Concise — your replies will be spoken aloud, so keep it natural (2-4 sentences)
- Use contractions and natural speech patterns (you're, I'll, let's, etc.)

You can help with: bookings, event planning, information requests, recommendations, social media content, and general assistance.
When asked what you can help with, give a brief, friendly overview and invite the user to get started.

When you have web search results available, weave the relevant facts naturally into your spoken response.
Never say "according to my search" or "I found that" — just speak the answer conversationally.

## Taking Restaurant Orders

When a caller wants to place a food or restaurant order:
1. Collect every item with its quantity. Ask about each item clearly: "Got it — how many would you like?"
2. Ask about any special instructions or substitutions.
3. Confirm a pickup time if not mentioned.
4. Read back the COMPLETE order before finalizing: item by item, quantity, any notes, and pickup time.
5. Wait for the caller to say "yes", "that's right", "sounds good", or any clear verbal confirmation.
6. ONLY AFTER explicit confirmation, call the \`record_restaurant_order\` tool. Do NOT call it speculatively.

After the tool returns, read back: the confirmation number, the itemized order summary, and the pickup time.
Example: "Perfect, you're all set! Your confirmation number is CCH-1234. That's two burgers and a large fries, ready at 6:30. See you then!"

If the tool returns an error, apologize warmly and offer to try again or take a message.`;

// ── CrewAI record_restaurant_order tool definition ───────────────────────────

const RESTAURANT_TOOL = {
  name: 'record_restaurant_order',
  description: `Record a confirmed restaurant order in the system and get a confirmation number.
Call this tool ONLY after the customer has explicitly confirmed their complete order verbally.
Do not call it speculatively or before confirmation.`,
  input_schema: {
    type: 'object',
    required: ['customer_phone', 'raw_transcript', 'items', 'estimated_intent'],
    properties: {
      customer_phone: {
        type: 'string',
        description: "The caller's phone number in E.164 format (e.g. +15551234567)"
      },
      raw_transcript: {
        type: 'string',
        description: 'The complete conversation transcript so far, used by back-office agents to validate the order'
      },
      items: {
        type: 'array',
        description: 'All items in the order',
        items: {
          type: 'object',
          required: ['name', 'quantity'],
          properties: {
            name:     { type: 'string',  description: 'Menu item name exactly as stated by caller' },
            quantity: { type: 'integer', description: 'Number of this item ordered', minimum: 1 },
            notes:    { type: 'string',  description: 'Special instructions for this item, e.g. "no onions", "extra sauce"' }
          }
        }
      },
      pickup_time: {
        type: 'string',
        description: 'Requested pickup time as stated by the caller, e.g. "6:30 PM" or "as soon as possible"'
      },
      estimated_intent: {
        type: 'string',
        enum: ['place_order', 'modify_order', 'cancel_order'],
        description: "The caller's confirmed intent"
      }
    }
  }
};

// ── Perplexity search ────────────────────────────────────────────────────────

async function searchPerplexity(query) {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.PERPLEXITY_MODEL || 'sonar',
      messages: [
        {
          role: 'system',
          content: 'Return only factual, current information. Be brief (3-5 sentences max). No markdown.'
        },
        { role: 'user', content: query }
      ],
      max_tokens: 300,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// ── Health ──────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Sophie Voice Agent',
    pipeline: 'perplexity → claude (+ tools) → elevenlabs',
    voice_id: process.env.ELEVENLABS_VOICE_ID,
    model: process.env.CLAUDE_MODEL,
    perplexity_model: process.env.PERPLEXITY_MODEL || 'sonar',
    crew_service: process.env.CREW_SERVICE_URL || 'http://localhost:8000',
    active_calls: callHistory.size,
    port: process.env.PORT || 3001
  });
});

// ── POST /speak ──────────────────────────────────────────────────────────────
// Body: { message: string }
// Returns: audio/mpeg stream (MP3)
// Header: X-Sophie-Text — the text Sophie said (URL-encoded)

app.post('/speak', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: '"message" is required and must be a non-empty string' });
  }

  console.log(`[speak] User: ${message}`);

  try {
    // ── Step 1: Perplexity live search ───────────────────────────────────
    let systemPrompt = SOPHIE_SYSTEM;
    try {
      const searchResults = await searchPerplexity(message.trim());
      systemPrompt += `\n\n[Web search results for context]\n${searchResults}`;
      console.log(`[perplexity] ${searchResults.substring(0, 120)}...`);
    } catch (err) {
      console.warn(`[perplexity] skipped: ${err.message}`);
    }

    // ── Step 2: Claude generates Sophie's reply ──────────────────────────
    const completion = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: message.trim() }]
    });

    const text = completion.content[0].text;
    console.log(`[speak] Sophie: ${text}`);

    // ── Step 3: ElevenLabs converts text to MP3 ──────────────────────────
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.50,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!ttsResponse.ok) {
      const errBody = await ttsResponse.text();
      throw new Error(`ElevenLabs ${ttsResponse.status}: ${errBody}`);
    }

    // ── Step 4: Stream MP3 back to caller ────────────────────────────────
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Sophie-Text', encodeURIComponent(text));
    ttsResponse.body.pipe(res);

  } catch (err) {
    console.error(`[speak] Error: ${err.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── POST /think  (text-only — Perplexity + Claude, no audio) ────────────────
app.post('/think', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: '"message" is required' });

  try {
    let systemPrompt = SOPHIE_SYSTEM;
    let searchResults = null;

    try {
      searchResults = await searchPerplexity(message.trim());
      systemPrompt += `\n\n[Web search results for context]\n${searchResults}`;
    } catch (err) {
      console.warn(`[perplexity] skipped: ${err.message}`);
    }

    const completion = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: message.trim() }]
    });

    res.json({
      reply: completion.content[0].text,
      search_used: !!searchResults,
      search_preview: searchResults ? searchResults.substring(0, 200) + '…' : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Twilio phone call handler ────────────────────────────────────────────────
//
// Flow: caller dials +18445835994
//   POST /twilio/voice   → greet + <Gather> speech input
//   POST /twilio/gather  → Whisper transcribes → Claude → ElevenLabs → <Play>
//   POST /twilio/gather  → loops until caller hangs up

app.use('/twilio', express.urlencoded({ extended: false })); // Twilio sends form data

// Greeting — plays on every new inbound call
app.post('/twilio/voice', (req, res) => {
  console.log(`[twilio] Inbound call from ${req.body.From || 'unknown'}`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Hi! You've reached Sophie, your Crystal Clear House concierge. How can I help you today?</Say>
  <Gather input="speech" action="/twilio/gather" method="POST"
          speechTimeout="auto" speechModel="experimental_conversations"
          language="en-US" timeout="5">
    <Say voice="woman">Go ahead, I'm listening.</Say>
  </Gather>
  <Say voice="woman">I didn't catch that. Please call back and I'll be happy to help!</Say>
</Response>`;

  res.type('text/xml').send(twiml);
});

// Per-call conversation history — keyed by CallSid, auto-expires after 30 min
const callHistory = new Map();

// Build a <Play>+<Gather> TwiML block
function gatherTwiml(audioUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Gather input="speech" action="/twilio/gather" method="POST"
          speechTimeout="auto" speechModel="experimental_conversations"
          language="en-US" timeout="8">
  </Gather>
  <Say voice="woman">Thank you for calling Crystal Clear House. Have a wonderful day!</Say>
</Response>`;
}

// Convert Sophie's text to ElevenLabs MP3, cache it, return a playable URL
async function textToAudioUrl(text) {
  const ttsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    }
  );
  if (!ttsRes.ok) throw new Error(`ElevenLabs ${ttsRes.status}`);

  const mp3Buffer = Buffer.from(await ttsRes.arrayBuffer());
  const audioId   = Date.now().toString();
  audioCache.set(audioId, mp3Buffer);
  setTimeout(() => audioCache.delete(audioId), 120_000);

  const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${baseUrl}/twilio/audio/${audioId}`;
}

// Gather — receives transcribed speech from Twilio, runs Sophie pipeline
app.post('/twilio/gather', async (req, res) => {
  const callerSpeech = req.body.SpeechResult || '';
  const confidence   = parseFloat(req.body.Confidence || '0');
  const callSid      = req.body.CallSid || 'unknown';
  const callerPhone  = req.body.From || 'unknown';

  console.log(`[twilio:${callSid.slice(-6)}] Heard (${Math.round(confidence * 100)}%): "${callerSpeech}"`);

  if (!callerSpeech.trim()) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">Sorry, I didn't catch that. Could you say that again?</Say>
  <Gather input="speech" action="/twilio/gather" method="POST"
          speechTimeout="auto" speechModel="experimental_conversations"
          language="en-US" timeout="5">
  </Gather>
</Response>`;
    return res.type('text/xml').send(twiml);
  }

  // ── Initialise per-call conversation history ────────────────────────────
  if (!callHistory.has(callSid)) {
    callHistory.set(callSid, []);
    setTimeout(() => callHistory.delete(callSid), 30 * 60 * 1000); // 30 min TTL
  }
  const history = callHistory.get(callSid);

  try {
    // 1. Build system prompt (with optional Perplexity search context)
    let systemPrompt = SOPHIE_SYSTEM +
      '\n\nIMPORTANT: You are on a live phone call. Keep responses to 1-3 sentences. Be warm but concise.';
    try {
      const searchResults = await searchPerplexity(callerSpeech);
      systemPrompt += `\n\n[Web search context]\n${searchResults}`;
    } catch (err) {
      console.warn(`[twilio] perplexity skipped: ${err.message}`);
    }

    // 2. Append caller's turn to history
    history.push({ role: 'user', content: callerSpeech });

    // 3. Claude — with conversation history and the order tool
    const completion = await anthropic.messages.create({
      model:      process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 300,
      system:     systemPrompt,
      messages:   history,
      tools:      [RESTAURANT_TOOL],
    });

    let sophieText;

    // ── Tool use: Claude wants to record an order ─────────────────────────
    if (completion.stop_reason === 'tool_use') {
      const toolUse = completion.content.find(b => b.type === 'tool_use');
      console.log(`[twilio] Tool call: ${toolUse.name}`, JSON.stringify(toolUse.input));

      // Add Claude's assistant turn (contains the tool_use block) to history
      history.push({ role: 'assistant', content: completion.content });

      // Call the CrewAI back-office service
      let toolResult;
      const crewUrl = `${process.env.CREW_SERVICE_URL || 'http://localhost:8000'}/crew/record_order`;
      try {
        const crewRes = await fetch(crewUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ...toolUse.input, call_id: callSid, customer_phone: callerPhone }),
        });
        toolResult = await crewRes.json();
        console.log(`[twilio] Crew result:`, JSON.stringify(toolResult));
      } catch (err) {
        console.error(`[twilio] Crew service error: ${err.message}`);
        toolResult = { error: `Order service unavailable: ${err.message}` };
      }

      // Feed tool result back to Claude so it can compose Sophie's reply
      history.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }]
      });

      const finalCompletion = await anthropic.messages.create({
        model:      process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 200,
        system:     systemPrompt,
        messages:   history,
      });
      sophieText = finalCompletion.content[0].text;
      history.push({ role: 'assistant', content: sophieText });

    } else {
      // ── Normal conversational reply ───────────────────────────────────
      sophieText = completion.content[0].text;
      history.push({ role: 'assistant', content: sophieText });
    }

    console.log(`[twilio] Sophie: ${sophieText}`);

    // 4. ElevenLabs TTS → cached MP3 → TwiML <Play>
    const audioUrl = await textToAudioUrl(sophieText);
    res.type('text/xml').send(gatherTwiml(audioUrl));

  } catch (err) {
    console.error(`[twilio] Error: ${err.message}`);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">I'm sorry, I'm having a little trouble right now. Please try again in a moment.</Say>
  <Gather input="speech" action="/twilio/gather" method="POST"
          speechTimeout="auto" language="en-US" timeout="5">
  </Gather>
</Response>`;
    res.type('text/xml').send(twiml);
  }
});

// Serve cached MP3 audio back to Twilio's <Play>
const audioCache = new Map();
app.get('/twilio/audio/:id', (req, res) => {
  const buf = audioCache.get(req.params.id);
  if (!buf) return res.status(404).send('Audio expired');
  res.type('audio/mpeg').send(buf);
});

// Status callback — Twilio posts here when a call ends; clean up history
app.post('/twilio/status', (req, res) => {
  const { CallSid, CallStatus } = req.body;
  if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(CallStatus)) {
    callHistory.delete(CallSid);
    console.log(`[twilio] Call ${CallSid?.slice(-6)} ended (${CallStatus}) — history cleared`);
  }
  res.sendStatus(204);
});

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => {
  console.log(`\n🎙  Sophie Voice Agent`);
  console.log(`   Port   : ${PORT}`);
  console.log(`   Model  : ${process.env.CLAUDE_MODEL}`);
  console.log(`   Voice  : ${process.env.ELEVENLABS_VOICE_ID}`);
  console.log(`\n   POST http://localhost:${PORT}/speak   → MP3`);
  console.log(`   POST http://localhost:${PORT}/think   → JSON`);
  console.log(`   GET  http://localhost:${PORT}/health  → status\n`);
});
