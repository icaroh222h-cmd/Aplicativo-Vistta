import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const uid = process.argv[2];
const revoke = process.argv[3] === 'revoke';
if (!uid) {
  console.error('Uso: node functions/scripts/set-owner-claim.mjs <UID> [revoke]');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT || 'vistta-2e1df' });
const user = await getAuth().getUser(uid);
const claims = { ...(user.customClaims || {}) };
if (revoke) {
  delete claims.role;
  delete claims.platformOwner;
  await getAuth().setCustomUserClaims(uid, Object.keys(claims).length ? claims : null);
  console.log(`Acesso developer removido do UID ${uid}. Faça logout/login para renovar o token.`);
} else {
  await getAuth().setCustomUserClaims(uid, { ...claims, role: 'developer', platformOwner: true });
  console.log(`Role developer aplicada ao UID ${uid} (${user.email || 'sem e-mail'}). Faça logout/login para renovar o token.`);
}
