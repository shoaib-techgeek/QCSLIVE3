import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetIdentityData, startTestApp, stopTestApp, type TestContext } from './helpers.js';

const PASSWORD = 'a-reasonably-long-passphrase';
const H = { 'x-requested-with': 'XMLHttpRequest' };
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const PDF = Buffer.from('%PDF-1.4\n%test');
const KINDS = ['cnic_front', 'cnic_back', 'business_registration', 'business_photo'];

function multipart(kind: string, filename: string, content: Buffer) {
  const boundary = '----qcsboundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\n${kind}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('seller KYC', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await startTestApp({ REQUIRE_EMAIL_VERIFICATION: 'false' }); });
  afterAll(async () => { await stopTestApp(ctx); });
  beforeEach(async () => {
    await resetIdentityData(ctx.db);
    await ctx.db('outbox_events').delete();
  });

  async function signIn(email: string): Promise<string> {
    await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: H, payload: { email, password: PASSWORD } });
    const login = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: H, payload: { email, password: PASSWORD } });
    return `sid=${login.cookies.find((c) => c.name === 'sid')!.value}`;
  }
  async function admin(): Promise<string> {
    const cookie = await signIn('admin@example.com');
    const user = await ctx.db('users').where({ email: 'admin@example.com' }).first('id');
    const role = await ctx.db('roles').where({ name: 'admin' }).first('id');
    await ctx.db('user_roles').insert({ user_id: user.id, role_id: role.id });
    return cookie;
  }
  const api = (cookie: string, method: string, url: string, payload?: object) =>
    ctx.app.inject({ method: method as 'GET', url: `/api/v1${url}`, headers: { ...H, cookie }, payload });
  const upload = (cookie: string, kind: string, filename: string, content: Buffer) => {
    const m = multipart(kind, filename, content);
    return ctx.app.inject({ method: 'POST', url: '/api/v1/seller/kyc/documents', headers: { ...H, cookie, ...m.headers }, payload: m.body });
  };
  const PII = { cnic: '42101-1234567-1', address: 'Shop 4, Main Market, Karachi', ntn: '1234567-8' };

  async function seller(email: string, store: string, { complete = true } = {}): Promise<string> {
    const cookie = await signIn(email);
    await api(cookie, 'POST', '/seller/profile', { storeName: store });
    if (complete) {
      for (const kind of KINDS) expect((await upload(cookie, kind, `${kind}.png`, PNG)).statusCode).toBe(201);
      expect((await api(cookie, 'PUT', '/seller/kyc/pii', PII)).statusCode).toBe(200);
    }
    return cookie;
  }
  const sellerId = async (cookie: string) => (await api(cookie, 'GET', '/seller/profile')).json().seller.id as string;

  describe('seller side', () => {
    it('requires a store first', async () => {
      const cookie = await signIn('ali@example.com');
      expect((await api(cookie, 'GET', '/seller/kyc')).statusCode).toBe(404);
    });

    it('rejects files whose content is not jpg/png/pdf, whatever the filename says', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders', { complete: false });
      const res = await upload(cookie, 'cnic_front', 'cnic.jpg', Buffer.from('<script>alert(1)</script>'));
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });

    it('rejects an unknown document kind and files over 5 MB', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders', { complete: false });
      expect((await upload(cookie, 'selfie', 'x.png', PNG)).statusCode).toBe(400);
      const big = await upload(cookie, 'cnic_front', 'x.png', Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]));
      expect(big.statusCode).toBe(413);
      expect(big.json().error.code).toBe('FILE_TOO_LARGE');
    });

    it('stores accepted files under random private keys and lists them without keys', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders', { complete: false });
      const res = await upload(cookie, 'business_registration', 'reg.pdf', PDF);
      expect(res.statusCode).toBe(201);
      expect(res.json().document).toMatchObject({ kind: 'business_registration', mime: 'application/pdf' });
      expect(JSON.stringify(res.json())).not.toMatch(/storage|kyc\//);
      const row = await ctx.db('kyc_documents').first();
      expect(row.storage_key).not.toContain('reg.pdf');
      expect(await ctx.storage.get(row.storage_key)).toEqual(PDF);
    });

    it('encrypts PII at rest and returns it masked', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const raw = JSON.stringify(await ctx.db('kyc_pii').first());
      expect(raw).not.toContain('4210112345671');
      expect(raw).not.toContain('Main Market');
      const kyc = (await api(cookie, 'GET', '/seller/kyc')).json().kyc;
      expect(kyc.pii).toEqual({ cnicLast4: '5671', hasAddress: true, hasNtn: true });
    });

    it('validates CNIC and address', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders', { complete: false });
      expect((await api(cookie, 'PUT', '/seller/kyc/pii', { ...PII, cnic: '123' })).statusCode).toBe(400);
      expect((await api(cookie, 'PUT', '/seller/kyc/pii', { ...PII, address: 'x' })).statusCode).toBe(400);
    });

    it('cannot submit until required documents and details exist, and says what is missing', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders', { complete: false });
      await upload(cookie, 'cnic_front', 'a.png', PNG);
      const res = await api(cookie, 'POST', '/seller/kyc/submit');
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('KYC_INCOMPLETE');
      expect(res.json().error.details.map((d: { path: string }) => d.path).sort())
        .toEqual(['business_photo', 'business_registration', 'cnic_back', 'pii'].sort());
    });

    it('submits, records history, audit and event, then locks editing', async () => {
      const cookie = await seller('ali@example.com', 'Ali Traders');
      const res = await api(cookie, 'POST', '/seller/kyc/submit');
      expect(res.statusCode).toBe(200);
      expect(res.json().kyc.status).toBe('submitted');
      expect((await api(cookie, 'GET', '/seller/profile')).json().seller.kycStatus).toBe('submitted');
      expect(await ctx.db('kyc_status_history').where({ to_status: 'submitted' })).toHaveLength(1);
      expect(await ctx.db('audit_events').where({ action: 'kyc.submitted' })).toHaveLength(1);
      expect(await ctx.db('outbox_events').where({ type: 'seller.kyc_submitted' })).toHaveLength(1);

      expect((await upload(cookie, 'cnic_front', 'b.png', PNG)).statusCode).toBe(409);
      expect((await api(cookie, 'PUT', '/seller/kyc/pii', PII)).statusCode).toBe(409);
      expect((await api(cookie, 'POST', '/seller/kyc/submit')).statusCode).toBe(409);
    });

    it('cannot delete another seller\'s document (404)', async () => {
      const a = await seller('ali@example.com', 'Ali Traders', { complete: false });
      const b = await seller('sara@example.com', 'Sara Shop', { complete: false });
      const doc = (await upload(a, 'cnic_front', 'a.png', PNG)).json().document;
      expect((await api(b, 'DELETE', `/seller/kyc/documents/${doc.id}`)).statusCode).toBe(404);
      expect((await api(a, 'DELETE', `/seller/kyc/documents/${doc.id}`)).statusCode).toBe(204);
      expect(await ctx.db('kyc_documents')).toHaveLength(0);
    });
  });

  describe('admin side', () => {
    it('401 without a session and 403 for non-reviewers', async () => {
      expect((await ctx.app.inject({ url: '/api/v1/admin/kyc' })).statusCode).toBe(401);
      const cookie = await seller('ali@example.com', 'Ali Traders');
      expect((await api(cookie, 'GET', '/admin/kyc')).statusCode).toBe(403);
      expect((await api(cookie, 'POST', `/admin/kyc/${await sellerId(cookie)}/decision`, { decision: 'approve' })).statusCode).toBe(403);
    });

    it('lists submitted applications, with a flag when the tax number is missing', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await api(a, 'POST', '/seller/kyc/submit');
      const b = await seller('sara@example.com', 'Sara Shop');
      await api(b, 'PUT', '/seller/kyc/pii', { cnic: '42101-7654321-0', address: 'Plot 9, Lahore road' });
      await api(b, 'POST', '/seller/kyc/submit');
      await seller('zara@example.com', 'Draft Store'); // not submitted: must not appear
      const adm = await admin();

      const list = (await api(adm, 'GET', '/admin/kyc')).json();
      expect(list.items.map((i: { storeName: string }) => i.storeName).sort()).toEqual(['Ali Traders', 'Sara Shop']);
      expect(JSON.stringify(list)).not.toContain('4210112345671');
      expect(list.items.find((i: { storeName: string }) => i.storeName === 'Sara Shop').flags).toEqual(['ntn_missing']);
    });

    it('shows full details and audits every PII view and document download', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await api(a, 'POST', '/seller/kyc/submit');
      const adm = await admin();
      const id = await sellerId(a);

      const detail = (await api(adm, 'GET', `/admin/kyc/${id}`)).json().kyc;
      expect(detail.pii).toMatchObject({ cnic: '4210112345671', address: PII.address, ntn: PII.ntn });
      expect(detail.documents).toHaveLength(4);
      expect(await ctx.db('audit_events').where({ action: 'kyc.pii_viewed' })).toHaveLength(1);

      const dl = await api(adm, 'GET', `/admin/kyc/${id}/documents/${detail.documents[0].id}`);
      expect(dl.statusCode).toBe(200);
      expect(dl.headers['content-type']).toBe('image/png');
      expect(dl.headers['cache-control']).toContain('no-store');
      expect(await ctx.db('audit_events').where({ action: 'kyc.document_viewed' })).toHaveLength(1);
    });

    it('walks start_review -> approve, grants the seller role and activates the store', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await api(a, 'POST', '/seller/kyc/submit');
      const adm = await admin();
      const id = await sellerId(a);
      expect((await api(a, 'GET', '/me')).json().account.permissions).not.toContain('seller:access');

      expect((await api(adm, 'POST', `/admin/kyc/${id}/decision`, { decision: 'start_review' })).statusCode).toBe(200);
      const done = await api(adm, 'POST', `/admin/kyc/${id}/decision`, { decision: 'approve' });
      expect(done.statusCode).toBe(200);
      expect(done.json().kyc.status).toBe('approved');

      const seller_ = (await api(a, 'GET', '/seller/profile')).json().seller;
      expect(seller_).toMatchObject({ status: 'active', kycStatus: 'approved' });
      expect((await api(a, 'GET', '/me')).json().account.permissions).toContain('seller:access');
      expect(await ctx.db('outbox_events').where({ type: 'seller.kyc_approved' })).toHaveLength(1);
      expect(await ctx.db('audit_events').where({ action: 'kyc.approved' })).toHaveLength(1);
    });

    it('requires a note to reject and refuses decisions on a finished application', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await api(a, 'POST', '/seller/kyc/submit');
      const adm = await admin();
      const id = await sellerId(a);
      await api(adm, 'POST', `/admin/kyc/${id}/decision`, { decision: 'start_review' });

      expect((await api(adm, 'POST', `/admin/kyc/${id}/decision`, { decision: 'reject' })).statusCode).toBe(400);
      expect((await api(adm, 'POST', `/admin/kyc/${id}/decision`, { decision: 'reject', note: 'Documents are unreadable' })).statusCode).toBe(200);
      const again = await api(adm, 'POST', `/admin/kyc/${id}/decision`, { decision: 'approve' });
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe('KYC_INVALID_TRANSITION');
      expect((await api(a, 'GET', '/me')).json().account.permissions).not.toContain('seller:access');
    });

    it('lets the seller fix and resubmit after a request for more information', async () => {
      const a = await seller('ali@example.com', 'Ali Traders');
      await api(a, 'POST', '/seller/kyc/submit');
      const adm = await admin();
      const id = await sellerId(a);
      await api(adm, 'POST', `/admin/kyc/${id}/decision`, { decision: 'start_review' });
      await api(adm, 'POST', `/admin/kyc/${id}/decision`, { decision: 'request_info', note: 'CNIC back is blurry' });

      const kyc = (await api(a, 'GET', '/seller/kyc')).json().kyc;
      expect(kyc).toMatchObject({ status: 'more_info_required', note: 'CNIC back is blurry' });
      expect((await upload(a, 'cnic_back', 'new.png', PNG)).statusCode).toBe(201);
      expect((await api(a, 'POST', '/seller/kyc/submit')).json().kyc.status).toBe('submitted');
    });

    it('unknown seller id gives 404', async () => {
      const adm = await admin();
      expect((await api(adm, 'GET', '/admin/kyc/00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
    });
  });
});
