/* Exercises the installed Firebase CLI's real ADC/WIF auth path with local,
   synthetic STS/impersonation endpoints. No Google credentials are used. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const cliRoot = path.resolve(process.argv[2]);
  assert.equal(require(path.join(cliRoot, 'package.json')).version, '15.32.1');
  const account = 'flympus-hosting-deployer@flympus.iam.gserviceaccount.com';
  const calls = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    calls.push(req.url);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/sts') {
      const form = new URLSearchParams(body);
      assert.equal(form.get('subject_token'), 'synthetic-github-oidc');
      assert.equal(form.get('subject_token_type'), 'urn:ietf:params:oauth:token-type:jwt');
      res.end(JSON.stringify({access_token:'synthetic-federated', token_type:'Bearer', expires_in:3600}));
    } else if (req.url.endsWith(':generateAccessToken')) {
      assert.equal(req.headers.authorization, 'Bearer synthetic-federated');
      assert.ok(JSON.parse(body).scope.includes('https://www.googleapis.com/auth/cloud-platform'));
      res.end(JSON.stringify({accessToken:'synthetic-impersonated', expireTime:new Date(Date.now()+3600000).toISOString()}));
    } else {
      res.statusCode = 404; res.end('{}');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'flympus-wif-test-'));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const tokenFile = path.join(directory, 'subject.txt');
    await fs.writeFile(tokenFile, 'synthetic-github-oidc');
    const credentialsFile = path.join(directory, 'adc.json');
    await fs.writeFile(credentialsFile, JSON.stringify({
      type:'external_account', audience:'//iam.googleapis.com/projects/272914048311/locations/global/workloadIdentityPools/github-hosting/providers/github',
      subject_token_type:'urn:ietf:params:oauth:token-type:jwt', token_url:`${origin}/sts`,
      service_account_impersonation_url:`${origin}/v1/projects/-/serviceAccounts/${account}:generateAccessToken`,
      credential_source:{file:tokenFile}
    }));
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsFile;
    delete process.env.FIREBASE_TOKEN;
    const {requireAuth} = require(path.join(cliRoot, 'lib/requireAuth.js'));
    assert.equal(await requireAuth({project:'flympus'}), account);
    assert.equal(await require(path.join(cliRoot, 'lib/apiv2.js')).getAccessToken(), 'synthetic-impersonated');
    assert.equal(calls.length, 2);
    assert.equal(calls[0], '/sts');
    assert.ok(calls[1].endsWith(`${account}:generateAccessToken`));
    console.log('Firebase CLI 15.32.1: real ADC → STS → service-account impersonation passed (synthetic endpoints).');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, {recursive:true, force:true});
  }
})().catch(error => {console.error(error.message); process.exitCode = 1;});
