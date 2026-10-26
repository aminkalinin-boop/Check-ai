/* Deployment configuration, bundled into the public HTML.
   A public HTTPS gateway URL is NOT a secret. API keys never belong here.
   Empty by default: the site still runs all offline checks and public
   bibliographic verification in online mode. */
'use strict';
const CHECK_AI_ONLINE_CONFIGURATION = Object.freeze({ apiBase: '' });
