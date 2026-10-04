/* FLYMPUS Firebase web configuration.
   Firebase web config values are public identifiers, not secrets.
   Never put Microsoft client secrets, service-account keys or private keys here.

   Google authentication is enforced in production. Microsoft authentication is
   staged behind a feature flag until the Entra application is registered. */
window.FLYMPUS_FIREBASE_CONFIG=Object.freeze({
  enabled:true,
  enforceAuth:true,
  microsoftEnabled:false,
  firebase:Object.freeze({
    apiKey:"AIzaSyAcg-KvQgauTOF_3uv7WOEhYcHqppbzT4k",
    authDomain:"flympus.firebaseapp.com",
    projectId:"flympus",
    storageBucket:"flympus.firebasestorage.app",
    messagingSenderId:"272914048311",
    appId:"1:272914048311:web:31cebb0e92d0a0d4f166b2"
  }),
  microsoftTenant:"common"
});
