import axios from 'axios';
const base = process.env.STORACHA_BASE || 'http://localhost:3001/rest';

export async function storachaUpload(base64: string, name: string, publishToFilecoin = false) {
  const { data } = await axios.post(base, {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'upload',
      arguments: {
        file: base64,
        name,
        publishToFilecoin
      }
    },
    id: Date.now()
  }, { timeout: 60_000 });

  if (data.error) {
    throw new Error(`Upload failed: ${data.error.message}`);
  }

  if (!data.result) {
    throw new Error('Invalid response from Storacha: missing result');
  }

  let result;
  if (data.result.content && Array.isArray(data.result.content)) {
    result = JSON.parse(data.result.content[0].text);
  } else if (typeof data.result === 'string') {
    result = JSON.parse(data.result);
  } else if (data.result.text) {
    result = JSON.parse(data.result.text);
  } else {
    result = data.result;
  }

  return { cid: result.root['/'] };
}

export async function storachaRetrieve(filepath: string) {
  const { data } = await axios.post(base, {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'retrieve',
      arguments: {
        filepath
      }
    },
    id: Date.now()
  }, { timeout: 60_000 });

  if (data.error) {
    throw new Error(`Retrieve failed: ${data.error.message}`);
  }

  if (!data.result) {
    throw new Error('Invalid response from Storacha: missing result');
  }

  let result;
  if (data.result.content && Array.isArray(data.result.content)) {
    result = JSON.parse(data.result.content[0].text);
  } else if (typeof data.result === 'string') {
    result = JSON.parse(data.result);
  } else if (data.result.text) {
    result = JSON.parse(data.result.text);
  } else {
    result = data.result;
  }

  const fileData = result.file || result.data;

  if (!fileData) {
    throw new Error('No file data returned from Storacha');
  }

  return { file: fileData };
}
