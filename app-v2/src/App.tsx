import { AccountPanel } from "./account/AccountPanel";
import { useAccount } from "./account/useAccount";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppData } from "./domain/types";
import { activeScenario } from "./data/appData";
import {
  createAppRepository,
  type StorageMode
} from "./data/repository";
import {
  isRestorableLiveSession,
  type PersistedLiveSession
} from "./session/sessionPersistence";
import { PwaUpdateNotice } from "./pwa/PwaUpdateNotice";
import { InstallNotice } from "./pwa/InstallNotice";
import { Setup } from "./features/setup/Setup";
import { Today } from "./features/today/Today";
import { Progress } from "./features/progress/Progress";
import { History } from "./features/history/History";
import { More } from "./features/more/More";
import { DepartureCuePracticeView } from "./features/cues/DepartureCuePracticeView";
import { LiveSession } from "./features/session/LiveSession";
import { BrandMark, BrandWordmark } from "./brand/BrandMark";
import type { Celebration } from "./features/progress/MilestoneBanner";
import { newlyEarnedAchievements, newlyEarnedMilestones } from "./domain/milestones";

type Screen = "today" | "progress" | "history" | "more";

export default function App() {
  const repository = useMemo(() => createAppRepository(), []);
  const persistLiveSession = useCallback(
    (snapshot: PersistedLiveSession) => repository.saveActiveSession(snapshot),
    [repository]
  );
  const [data, setData] = useState<AppData | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("indexeddb");
  const [screen, setScreen] = useState<Screen>("today");
  const [liveTarget, setLiveTarget] = useState<number | null>(null);
  const [cuePracticeOpen, setCuePracticeOpen] = useState(false);
  const [restoredState, setRestoredState] =
    useState<PersistedLiveSession["state"] | undefined>(undefined);
  const [accountOpen, setAccountOpen] = useState(false);
  const account = useAccount(repository, setData, liveTarget !== null || cuePracticeOpen);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      repository.loadAppData(),
      repository.loadActiveSession()
    ]).then(([loadedData, active]) => {
      if (cancelled) return;
      setData(loadedData);
      setStorageMode(repository.storageMode());

      if (
        isRestorableLiveSession(active) &&
        loadedData.scenarios.some((scenario) => scenario.id === active.scenarioId)
      ) {
        setData({ ...loadedData, activeScenarioId: active.scenarioId });
        setLiveTarget(active.targetSeconds);
        setRestoredState(active.state);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repository]);

  if (!data) {
    return (
      <main className="setup-shell">
        <section className="setup-card loading-card" aria-live="polite">
          <BrandMark light />
          <p className="kicker">Opening SettledSolo</p>
          <h1>Getting things ready.</h1>
        </section>
      </main>
    );
  }

  if (accountOpen) {
    return <main className="app-shell"><div className="app-content"><button onClick={() => setAccountOpen(false)}>Back to training</button><AccountPanel data={data} account={account} /></div></main>;
  }

  if (!data.dogName) {
    return (
      <Setup
        onOpenAccount={() => setAccountOpen(true)}
        onSaved={async (dogName, startSeconds, startingPath) => {
          setData(
            await repository.saveSetup(dogName, startSeconds, startingPath)
          );
          setStorageMode(repository.storageMode());
        }}
      />
    );
  }

  if (cuePracticeOpen) {
    return (
      <DepartureCuePracticeView
        data={data}
        onClose={() => setCuePracticeOpen(false)}
        onSaved={async (session, nextLevel) => {
          setData(await repository.appendDepartureCueSession(session, nextLevel));
          setStorageMode(repository.storageMode());
          setCuePracticeOpen(false);
          setScreen("today");
        }}
      />
    );
  }

  if (liveTarget !== null) {
    return (
      <LiveSession
        scenarioId={activeScenario(data).id}
        scenarioLabel={activeScenario(data).label}
        targetSeconds={liveTarget}
        dogName={data.dogName}
        initialState={restoredState}
        variabilitySeed={activeScenario(data).sessions.length}
        warmupCount={activeScenario(data).warmupCount}
        shuffleWarmups={activeScenario(data).shuffleWarmups}
        restSeconds={activeScenario(data).restSeconds ?? 60}
        onPersist={persistLiveSession}
        onClose={async () => {
          await repository.clearActiveSession();
          setLiveTarget(null);
          setRestoredState(undefined);
        }}
        onSaved={async (session) => {
          const before = data;
          const after = await repository.appendSession(
            session,
            activeScenario(data).id
          );
          setData(after);
          setStorageMode(repository.storageMode());
          await repository.clearActiveSession();
          setLiveTarget(null);
          setRestoredState(undefined);
          setScreen("today");

          const milestones = newlyEarnedMilestones(before, after);
          const achievements = newlyEarnedAchievements(before, after);
          setCelebration(
            milestones.length || achievements.length
              ? { milestones, achievements }
              : null
          );
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="app-brand-link" href="/" aria-label="SettledSolo home">
          <BrandWordmark compact light />
        </a>
        <div className="dog-chip">{data.dogName}</div>
      </header>

      <main className="app-content">
        <InstallNotice />
        {screen === "today" && (
          <Today
            data={data}
            storageMode={storageMode}
            celebration={celebration}
            onDismissCelebration={() => setCelebration(null)}
            onStart={async (target) => {
              account.pauseForTraining();
              const latest = await repository.loadAppData();
              setData(latest);
              setCelebration(null);
              setRestoredState(undefined);
              setLiveTarget(target);
            }}
            onRecordObservation={async (outcome, findings) => {
              setData(
                await repository.recordPreProtocolObservation(outcome, findings)
              );
              setStorageMode(repository.storageMode());
            }}
            onOpenCuePractice={async () => {
              account.pauseForTraining();
              setData(await repository.loadAppData());
              setCuePracticeOpen(true);
            }}
            onOpenAccount={() => setScreen("more")}
          />
        )}
        {screen === "progress" && <Progress data={data} />}
        {screen === "history" && (
          <History
            data={data}
            onAddSession={async (scenarioId, session) => {
              setData(await repository.appendSession(session, scenarioId));
              setStorageMode(repository.storageMode());
            }}
            onUpdateSession={async (scenarioId, session) => {
              setData(await repository.updateSession(scenarioId, session));
              setStorageMode(repository.storageMode());
            }}
            onDeleteSession={async (scenarioId, sessionId) => {
              setData(await repository.deleteSession(scenarioId, sessionId));
              setStorageMode(repository.storageMode());
            }}
          />
        )}
        {screen === "more" && (
          <More
            accountPanel={<AccountPanel data={data} account={account} />}
            data={data}
            onSelectScenario={async (id) => {
              setData(await repository.setActiveScenario(id));
              setStorageMode(repository.storageMode());
            }}
            onCreateScenario={async (label, startSeconds) => {
              setData(await repository.createScenario(label, startSeconds));
              setStorageMode(repository.storageMode());
            }}
            onUpdateScenario={async (
              id,
              label,
              startSeconds,
              warmupCount,
              restSeconds,
              shuffleWarmups
            ) => {
              setData(
                await repository.updateScenario(
                  id,
                  label,
                  startSeconds,
                  warmupCount,
                  restSeconds,
                  shuffleWarmups
                )
              );
              setStorageMode(repository.storageMode());
            }}
            onUpdateDailyCap={async (cap) => {
              setData(await repository.updateDailyCap(cap));
              setStorageMode(repository.storageMode());
            }}
            onRestoreBackup={async (restored) => {
              await repository.clearActiveSession();
              await repository.saveAppData(restored);
              setData(await repository.loadAppData());
              setStorageMode(repository.storageMode());
              setRestoredState(undefined);
              setLiveTarget(null);
              setCelebration(null);
              setScreen("today");
            }}
            onResetApp={async () => {
              const fresh = await repository.resetAppData();
              setData(fresh);
              setStorageMode(repository.storageMode());
              setRestoredState(undefined);
              setLiveTarget(null);
              setCuePracticeOpen(false);
              setCelebration(null);
              setScreen("today");
            }}
          />
        )}
      </main>

      <PwaUpdateNotice />

      <nav className="bottom-nav" aria-label="Main navigation">
        {([
          ["today", "Today"],
          ["progress", "Progress"],
          ["history", "History"],
          ["more", "More"]
        ] as const).map(([value, label]) => (
          <button
            key={value}
            aria-current={screen === value ? "page" : undefined}
            onClick={() => setScreen(value)}
          >
            <span className="nav-mark" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
