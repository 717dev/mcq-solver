import { solveMCQWithGemini } from '../lib/gemini';

// Simple 1x1 transparent GIF / JPEG base64
const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function test() {
  console.log('Testing solveMCQWithGemini...');
  const res = await solveMCQWithGemini(testBase64, 'image/png');
  console.log('Result:', JSON.stringify(res, null, 2));
}

test();
