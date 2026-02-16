/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { Utils } = ChromeUtils.importESModule(
  "resource://services-settings/Utils.sys.mjs"
);

function clear_state() {
  Services.prefs.clearUserPref("services.settings.server");
  Services.prefs.clearUserPref("enterprise.console.address");
}

add_setup(async function () {
  registerCleanupFunction(() => {
    clear_state();
  });
});

add_task(clear_state);

add_task(
  {
    skip_if: () => !AppConstants.MOZ_ENTERPRISE,
  },
  async function test_server_url_derived_from_console_address() {
    Services.prefs.setStringPref(
      "enterprise.console.address",
      "https://console.example.com"
    );

    Assert.equal(
      Utils.SERVER_URL,
      "https://console.example.com/api/browser/remote-settings",
      "SERVER_URL should be derived from console address"
    );
  }
);
add_task(clear_state);

add_task(
  {
    skip_if: () => !AppConstants.MOZ_ENTERPRISE,
  },
  async function test_server_url_pref_overrides_console_address() {
    Services.prefs.setStringPref(
      "enterprise.console.address",
      "https://console.example.com"
    );
    Services.prefs.setStringPref(
      "services.settings.server",
      "https://custom-rs.example.com/v1"
    );

    Assert.equal(
      Utils.SERVER_URL,
      "https://custom-rs.example.com/v1",
      "SERVER_URL should prefer the server pref over console address"
    );
  }
);
add_task(clear_state);

add_task(
  {
    skip_if: () => !AppConstants.MOZ_ENTERPRISE,
  },
  async function test_bearer_auth_header_sent() {
    const server = new HttpServer();
    server.start(-1);
    const serverBase = `http://localhost:${server.identity.primaryPort}`;

    let receivedAuthHeader = null;
    server.registerPathHandler(
      "/api/browser/remote-settings",
      (request, response) => {
        receivedAuthHeader = request.hasHeader("Authorization")
          ? request.getHeader("Authorization")
          : null;
        response.setStatusLine(null, 200, "OK");
        response.setHeader("Content-Type", "application/json");
        response.write("{}");
      }
    );

    Services.prefs.setStringPref("enterprise.console.address", serverBase);
    Services.felt.setTokens("test-access-token", "refresh", 3600);

    try {
      await Utils.fetch(Utils.SERVER_URL);

      Assert.equal(
        receivedAuthHeader,
        "Bearer test-access-token",
        "Request should include Bearer auth header with access token"
      );
    } finally {
      Services.felt.setTokens("", "", 0);
      await new Promise(resolve => server.stop(resolve));
    }
  }
);
add_task(clear_state);
