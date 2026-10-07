/** Shared HubSpot fields and transport. Each form owns its completion behavior. */
(function () {
  'use strict';
  var endpoint = 'https://api.hsforms.com/submissions/v3/integration/submit/' +
    '48367061/b6da14d0-d60d-4357-89fc-0015ed32b704';

  function payload(values, message, pageName) {
    return {
      fields: [
        { name: 'company', value: values.company },
        { name: 'busyo', value: values.department },
        { name: 'lastname', value: values.name },
        { name: 'firstname', value: values.name },
        { name: 'email', value: values.email },
        { name: 'message', value: message }
      ],
      context: { pageUri: window.location.href, pageName: pageName }
    };
  }

  function send(data, keepalive) {
    var options = {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
    if (keepalive) options.keepalive = true;
    return fetch(endpoint, options);
  }

  window.bmLead = { payload: payload, send: send };
})();
