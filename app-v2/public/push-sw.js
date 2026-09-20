self.addEventListener("push", function (event) {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windows) {
        var visible = windows.some(function (client) {
          return client.visibilityState === "visible";
        });

        return self.registration.showNotification("Time to come back", {
          body: "Your SettledSolo return point has been reached.",
          tag: "settledsolo-return",
          renotify: !visible,
          requireInteraction: true,
          silent: visible,
          icon: "/icon.svg",
          badge: "/icon.svg",
          data: { url: new URL("/app/", self.registration.scope).href }
        });
      })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : new URL("/app/", self.registration.scope).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windows) {
        for (var index = 0; index < windows.length; index += 1) {
          var client = windows[index];
          if (client.url.indexOf(self.registration.scope) === 0 && "focus" in client) {
            return client.focus().then(function () {
              if ("navigate" in client) return client.navigate(target);
              return client;
            });
          }
        }

        return self.clients.openWindow ? self.clients.openWindow(target) : null;
      })
  );
});
