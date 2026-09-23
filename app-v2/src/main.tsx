import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { SingleWindowGuard } from "./app/SingleWindowGuard";
import { PublicRouter } from "./public/PublicRouter";
import { APP_META } from "./public/pageMeta";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/karla/400.css";
import "@fontsource/karla/500.css";
import "@fontsource/karla/600.css";
import "@fontsource/karla/700.css";
import "./styles.css";

const isAppRoute = /^\/app(?:\/|$)/.test(window.location.pathname);

const robots =
  document.querySelector<HTMLMetaElement>('meta[name="robots"]') ??
  document.head.appendChild(document.createElement("meta"));
robots.name = "robots";
robots.content = isAppRoute ? "noindex,nofollow" : "index,follow";

if (isAppRoute) {
  document.title = APP_META.title;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary offerBackup={isAppRoute}>
      {isAppRoute ? <SingleWindowGuard>{compatibility => <App singleWindowCompatibility={compatibility} />}</SingleWindowGuard> : <PublicRouter />}
    </AppErrorBoundary>
  </StrictMode>
);
