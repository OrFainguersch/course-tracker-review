/* FLYMPUS Firebase web configuration.
   Firebase web config values are public identifiers, not secrets.
   Never put Microsoft client secrets, service-account keys or private keys here.

   Production remains intentionally disabled until:
   1) a Firebase Spark project is connected,
   2) Google + Microsoft providers are enabled,
   3) firestore.rules is deployed,
   4) the first administrator is promoted in the Firebase console, and
   5) user-owned training data is scoped/migrated by authenticated UID. */
window.FLYMPUS_FIREBASE_CONFIG=Object.freeze({
  enabled:false,
  enforceAuth:false,
  firebase:Object.freeze({
    apiKey:"",
    authDomain:"",
    projectId:"",
    storageBucket:"",
    messagingSenderId:"",
    appId:""
  }),
  microsoftTenant:"common"
});
