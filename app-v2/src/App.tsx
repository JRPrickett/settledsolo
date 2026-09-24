import { StorageNotice } from "./components/StorageNotice";
import { AccountPanel } from "./account/AccountPanel";
import { useAccount } from "./account/useAccount";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  clearCueCheckpoint,
  loadCueCheckpoint,
  type CueCheckpoint
} from "./session/cueCheckpoint";
import { InstallNotice } from "./pwa/InstallNotice";
import { Setup } from "./features/setup/Setup";
import { Today } from "./features/today/Today";
import { Progress } from "./features/progress/Progress";
import { History } from "./features/history/History";
import { More } from "./features/more/More";
import { DepartureCuePracticeView } from "./features/cues/DepartureCuePracticeView";
import { TrainingSummaryView } from "./features/summary/TrainingSummaryView";
import { JournalView, type JournalFocus } from "./features/journal/JournalView";
import { LiveSession } from "./features/session/LiveSession";
import { BrandMark, BrandWordmark } from "./brand/BrandMark";
import type { Celebration } from "./features/progress/MilestoneBanner";
import { newlyEarnedAchievements, newlyEarnedMilestones } from "./domain/milestones";
import { effectiveDailyCap, isDailyCapReached } from "./domain/dailyCap";

type Screen = "today" | "progress" | "history" | "more";

export default function App({ singleWindowCompatibility = false }: { singleWindowCompatibility?: boolean }) {
  const repository = useMemo(
    () => createAppRepository({ useWebLocks: !singleWindowCompatibility }),
    [singleWindowCompatibility]
  );
  const persistLiveSession = useCallback(
    (snapshot: PersistedLiveSession) => repository.saveActiveSession(snapshot),
    [repository]
  );
  const [data, setData] = useState<AppData | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("indexeddb");
  const [screen, setScreen] = useState<Screen>("today");
  const [liveTarget, setLiveTarget] = useState<number | null>(null);
  const [liveWarmupSeed, setLiveWarmupSeed] = useState<number | null>(null);
  const [cuePracticeOpen, setCuePracticeOpen] = useState(false);
  const [cueResume, setCueResume] = useState<CueCheckpoint | undefined>(undefined);
  const [restoredState, setRestoredState] =
    useState<PersistedLiveSession["state"] | undefined>(undefined);
  const [accountOpen, setAccountOpen] = useState(false);
  const inSession = liveTarget !== null || cuePracticeOpen;
  const account = useAccount(repository, setData, inSession);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  // The summary and journal open from part-way down a screen; closing returns there.
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [journalFocus, setJournalFocus] = useState<JournalFocus | null>(null);
  const overlayReturnScroll = useRef<number | null>(null);
  const openSummary = useCallback(() => {
    overlayReturnScroll.current = window.scrollY;
    setSummaryOpen(true);
  }, []);
  const openJournal = useCallback((focus: JournalFocus) => {
    overlayReturnScroll.current = window.scrollY;
    setJournalFocus(focus);
  }, []);
  const overlayOpen = summaryOpen || journalFocus !== null;
  useEffect(() => {
    if (overlayOpen || overlayReturnScroll.current === null) return;
    window.scrollTo(0, overlayReturnScroll.current);
    overlayReturnScroll.current = null;
  }, [overlayOpen]);

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
        setLiveWarmupSeed(null);
        setRestoredState(active.state);
        return;
      }

      // Resume an unfinished departure-cue set, unless it was already saved just
      // before the app closed (its checkpoint then predates the saved set).
      const cue = loadCueCheckpoint();
      const cueScenario = cue
        ? loadedData.scenarios.find((scenario) => scenario.id === cue.scenarioId)
        : undefined;
      const lastSavedAt = Math.max(
        0,
        ...(cueScenario?.cuePractice?.sessions ?? []).map((session) => session.at)
      );
      if (cue && cueScenario && loadedData.dogName && cue.savedAt > lastSavedAt) {
        setData({ ...loadedData, activeScenarioId: cue.scenarioId });
        setCueResume(cue);
        setCuePracticeOpen(true);
      } else if (cue) {
        clearCueCheckpoint();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repository]);

  useEffect(() => repository.subscribeStorageMode(setStorageMode), [repository]);

  // Each screen is a fresh page: never land part-way down it because the previous
  // screen was scrolled, including after returning from a session or the account view,
  // and after finishing (or restarting) first-run setup.
  const onboarded = Boolean(data?.dogName);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, inSession, accountOpen, onboarded]);

  function renderContent() {
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
        onOpenAccount={
          account.ready && !account.user
            ? () => setAccountOpen(true)
            : undefined
        }
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
        resume={cueResume}
        onClose={() => {
          setCueResume(undefined);
          setCuePracticeOpen(false);
        }}
        onSaved={async (session, nextLevel) => {
          setData(await repository.appendDepartureCueSession(session, nextLevel));
          setStorageMode(repository.storageMode());
          setCueResume(undefined);
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
        variabilitySeed={
          liveWarmupSeed ?? activeScenario(data).sessions.length
        }
        warmupCount={activeScenario(data).warmupCount}
        restSeconds={activeScenario(data).restSeconds ?? 60}
        onPersist={persistLiveSession}
        onClose={async () => {
          await repository.clearActiveSession();
          setLiveTarget(null);
          setLiveWarmupSeed(null);
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
          setLiveWarmupSeed(null);
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

  if (summaryOpen) {
    return <TrainingSummaryView data={data} onClose={() => setSummaryOpen(false)} />;
  }

  if (journalFocus !== null) {
    return (
      <JournalView
        data={data}
        focus={journalFocus}
        onClose={() => setJournalFocus(null)}
        onSave={async (journal) => {
          setData(await repository.saveJournal(journal));
          setStorageMode(repository.storageMode());
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
        <div className="dog-chip" title={data.dogName}>{data.dogName}</div>
      </header>

      <main className="app-content">
        <InstallNotice />
        {screen === "today" && (
          <Today
            data={data}
            storageMode={storageMode}
            celebration={celebration}
            onDismissCelebration={() => setCelebration(null)}
            onStart={async (target, warmupSeed) => {
              const latest = await repository.loadAppData();
              setData(latest);
              if (isDailyCapReached(latest, effectiveDailyCap(latest))) {
                return false;
              }
              account.pauseForTraining();
              setCelebration(null);
              setRestoredState(undefined);
              setLiveWarmupSeed(warmupSeed);
              setLiveTarget(target);
              return true;
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
            onOpenSummary={openSummary}
            onOpenJournal={openJournal}
          />
        )}
        {screen === "progress" && <Progress data={data} onOpenJournal={openJournal} />}
        {screen === "history" && (
          <History
            data={data}
            onOpenSummary={openSummary}
            onOpenJournal={openJournal}
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
            onOpenSummary={openSummary}
            storageMode={storageMode}
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
              restSeconds
            ) => {
              setData(
                await repository.updateScenario(
                  id,
                  label,
                  startSeconds,
                  warmupCount,
                  restSeconds
                )
              );
              setStorageMode(repository.storageMode());
            }}
            onUpdateDailyCap={async (cap) => {
              setData(await repository.updateDailyCap(cap));
              setStorageMode(repository.storageMode());
            }}
            onRestoreBackup={async (restored) => {
              clearCueCheckpoint();
              await repository.clearActiveSession();
              await repository.saveAppData(restored);
              setData(await repository.loadAppData());
              setStorageMode(repository.storageMode());
              setRestoredState(undefined);
              setLiveTarget(null);
              setLiveWarmupSeed(null);
              setCelebration(null);
              setScreen("today");
            }}
            onResetApp={async () => {
              clearCueCheckpoint();
              const fresh = await repository.resetAppData();
              setData(fresh);
              setStorageMode(repository.storageMode());
              setRestoredState(undefined);
              setLiveTarget(null);
              setLiveWarmupSeed(null);
              setCuePracticeOpen(false);
              setCelebration(null);
              setScreen("today");
            }}
          />
        )}
      </main>

      <PwaUpdateNotice canUpdate={storageMode !== "memory"} />

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

  return (
    <>
      {data && <StorageNotice data={data} mode={storageMode} training={inSession} />}
      {renderContent()}
    </>
  );
}
