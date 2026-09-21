# SettledSolo usage metrics

SettledSolo no longer uses the custom product-event analytics pipeline that stored
app opens, session starts/saves or device metadata in a dedicated D1 database.

## Canonical user count

Registered accounts are the reliable user metric. They are counted directly from the
isolated Better Auth database without exposing email addresses or training data.

From GitHub, run **Count registered accounts** and choose `production` or `preview`.
The workflow prints only the total number of rows in Better Auth's `user` table.

The same check can be run locally when the Cloudflare credentials and account D1 IDs are
available:

```sh
npm run accounts:count -- production
```

## Installed PWA count

Browsers do not provide a reliable server-side count of installed PWAs across iOS,
Android and desktop. SettledSolo therefore does not claim an exact "installed users"
number or add a persistent installation identifier just to manufacture one.

Cloudflare Web Analytics may still be used for aggregate site traffic where it is
enabled, but visitor counts are directional traffic metrics rather than an account or
installation count.

## Retired event analytics

The legacy `threshold-events` Worker and `threshold-analytics` D1 integration have
been removed from the repository. After this change is merged, the Cloudflare resources
can be deleted as infrastructure cleanup:

1. delete the `threshold-events` Worker if it is still deployed;
2. delete the `threshold-analytics` D1 database after any final export you want to keep.

Neither resource is used by the modern SettledSolo app or by account sync.
