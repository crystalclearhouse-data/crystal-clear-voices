import fetch from 'node-fetch';
import readline from 'readline';
import { spawn } from 'child_process';
import fs from 'fs';

const VOICE_SERVER = 'http://localhost:3001';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function talkToSophie() {
  console.log('\n🎤 Sophie Voice Agent (Interactive Mode)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Type your question and press Enter.');
  console.log('Sophie will respond with voice + text.');
  console.log('Type "exit" to quit.\n');

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('\nGoodbye! 👋\n');
        rl.close();
        return;
      }

      if (!input.trim()) {
        askQuestion();
        return;
      }

      try {
        console.log('\n⏳ Sophie thinking...');

        // Call voice-server /speak endpoint
        const response = await fetch(`${VOICE_SERVER}/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input.trim() })
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        // Get the text Sophie said (from header)
        const sophieText = decodeURIComponent(response.headers.get('x-sophie-text') || 'No response');
        
        // Save MP3 to temp file
        const tempFile = `/tmp/sophie-${Date.now()}.mp3`;
        const fileStream = fs.createWriteStream(tempFile);
        
        await new Promise((resolve, reject) => {
          response.body.pipe(fileStream);
          response.body.on('error', reject);
          fileStream.on('finish', resolve);
        });

        console.log(`\n🎙️  Sophie: ${sophieText}\n`);

        // Play audio
        const player = spawn('afplay', [tempFile]);
        
        player.on('close', (code) => {
          fs.unlink(tempFile, () => {}); // Clean up temp file
          askQuestion();
        });

      } catch (err) {
        console.error(`\n❌ Error: ${err.message}\n`);
        askQuestion();
      }
    });
  };

  askQuestion();
}

talkToSophie();
