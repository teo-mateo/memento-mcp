#!/usr/bin/env node

// Test script for Azure OpenAI Embeddings API
// Usage: node test-azure-openai.js

import https from 'https';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testAzureOpenAI() {
  console.log('Azure OpenAI Embeddings Test Script');
  console.log('===================================\n');

  // Get configuration from user
  const endpoint = await question('Enter your Azure OpenAI endpoint (e.g., https://your-resource.openai.azure.com): ');
  const apiKey = await question('Enter your Azure OpenAI API key: ');
  const deploymentName = await question('Enter your deployment name (e.g., text-embedding-ada-002): ');
  const apiVersion = await question('Enter API version (default: 2023-05-15): ') || '2023-05-15';

  console.log('\nTesting connection...\n');

  // Prepare the request
  const testText = "Hello, this is a test of Azure OpenAI embeddings";
  const requestBody = JSON.stringify({
    input: testText,
    model: deploymentName
  });

  // Parse endpoint URL
  const url = new URL(`${endpoint}/openai/deployments/${deploymentName}/embeddings?api-version=${apiVersion}`);
  
  const options = {
    hostname: url.hostname,
    port: 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  // Make the request
  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`Status Code: ${res.statusCode}`);
      console.log(`Status Message: ${res.statusMessage}\n`);

      try {
        const response = JSON.parse(data);
        
        if (res.statusCode === 200) {
          console.log('✅ Success! Azure OpenAI is working correctly.\n');
          console.log('Response details:');
          console.log(`- Model: ${response.model}`);
          console.log(`- Usage: ${JSON.stringify(response.usage)}`);
          console.log(`- Embedding dimensions: ${response.data[0].embedding.length}`);
          console.log(`- First 10 values: [${response.data[0].embedding.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]`);
          
          console.log('\n📝 Configuration for Memento MCP:');
          console.log('Add these to your .env file or export as environment variables:\n');
          console.log(`export AZURE_OPENAI_API_KEY="${apiKey}"`);
          console.log(`export AZURE_OPENAI_ENDPOINT="${endpoint}"`);
          console.log(`export AZURE_OPENAI_DEPLOYMENT="${deploymentName}"`);
          console.log(`export AZURE_OPENAI_API_VERSION="${apiVersion}"`);
          
        } else {
          console.log('❌ Error response from Azure OpenAI:');
          console.log(JSON.stringify(response, null, 2));
          
          if (res.statusCode === 401) {
            console.log('\n💡 Hint: Check your API key is correct');
          } else if (res.statusCode === 404) {
            console.log('\n💡 Hint: Check your endpoint and deployment name');
          } else if (res.statusCode === 429) {
            console.log('\n💡 Hint: Rate limit exceeded, wait a moment and try again');
          }
        }
      } catch (e) {
        console.log('❌ Failed to parse response:');
        console.log(data);
      }
      
      rl.close();
    });
  });

  req.on('error', (e) => {
    console.error('❌ Request failed:', e.message);
    console.log('\n💡 Hints:');
    console.log('- Check your internet connection');
    console.log('- Verify the endpoint URL is correct');
    console.log('- Ensure the endpoint includes https://');
    rl.close();
  });

  // Send the request
  req.write(requestBody);
  req.end();
}

// Run the test
testAzureOpenAI().catch(console.error);