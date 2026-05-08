const STORAGE_KEY = "forest-roads-state-v1";
const CLOUD_DOC_VERSION = 1;
const FIREBASE_SDK_BASE = "https://www.gstatic.com/firebasejs/10.12.5";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const firebaseSettings = window.FOREST_ROADS_FIREBASE || { enabled: false, config: {} };
const GOOGLE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.35 11.1H12v3.8h5.36c-.24 1.24-.96 2.28-2.04 2.96v2.46h3.3c1.94-1.78 3.06-4.4 3.06-7.5 0-.58-.05-1.14-.33-1.72Z" /><path d="M12 22c2.76 0 5.08-.9 6.78-2.45l-3.3-2.46c-.92.6-2.08.96-3.48.96-2.67 0-4.93-1.73-5.74-4.06H2.85v2.54A10.2 10.2 0 0 0 12 22Z" /><path d="M6.26 13.99A5.87 5.87 0 0 1 5.94 12c0-.7.12-1.37.32-1.99V7.47H2.85A9.74 9.74 0 0 0 1.8 12c0 1.63.38 3.18 1.05 4.53l3.41-2.54Z" /><path d="M12 5.95c1.5 0 2.85.5 3.91 1.49l2.93-2.8C17.07 3.02 14.76 2 12 2a10.2 10.2 0 0 0-9.15 5.47l3.41 2.54C7.07 7.68 9.33 5.95 12 5.95Z" /></svg>';

const AREA_LABELS = {
  corpo: "Corpo",
  mente: "Mente",
  foco: "Foco",
  estudo: "Estudo",
  social: "Social",
  casa: "Casa",
};

const STAGES = [
  { max: 14, label: "mata fechada", caption: "A entrada ainda exige decisão consciente." },
  { max: 34, label: "trilha abafada", caption: "Os primeiros passos já aparecem entre as plantas." },
  { max: 54, label: "caminho", caption: "A repetição começa a reduzir o atrito." },
  { max: 76, label: "estrada de terra", caption: "O comportamento está ficando mais automático." },
  { max: 100, label: "estrada firme", caption: "A rota está forte, mas ainda precisa de manutenção." },
];

const DEFAULT_FORM = {
  name: "",
  area: "mente",
  color: "#d28a3c",
  minimum: "",
  cue: "",
  reward: "",
  environment: "",
  frequency: "daily",
  weekdays: [1, 2, 3, 4, 5],
  target: 66,
  friction: 3,
  decay: 3,
};

const state = loadState();
let editingId = state.selectedHabitId || null;
let currentToast = null;
let animationFrame = 0;
let lastCanvasSize = "";
const localStateSnapshotAtBoot = clonePlainState(state);
const cloud = {
  enabled: false,
  status: "local",
  user: null,
  auth: null,
  db: null,
  provider: null,
  modules: null,
  docRef: null,
  unsubscribe: null,
  saveTimer: 0,
  suppressSave: false,
  lastSavedAt: null,
  message: "Dados salvos neste navegador.",
};

const elements = {
  journalDate: document.querySelector("#journalDate"),
  todayList: document.querySelector("#todayList"),
  habitList: document.querySelector("#habitList"),
  syncBadge: document.querySelector("#syncBadge"),
  accountAvatar: document.querySelector("#accountAvatar"),
  accountName: document.querySelector("#accountName"),
  accountEmail: document.querySelector("#accountEmail"),
  googleSignInButton: document.querySelector("#googleSignInButton"),
  syncLocalButton: document.querySelector("#syncLocalButton"),
  signOutButton: document.querySelector("#signOutButton"),
  syncStatus: document.querySelector("#syncStatus"),
  profileButton: document.querySelector("#profileButton"),
  profilePopover: document.querySelector("#profilePopover"),
  newHabitButton: document.querySelector("#newHabitButton"),
  editHabitButton: document.querySelector("#editHabitButton"),
  habitDialog: document.querySelector("#habitDialog"),
  closeHabitDialogButton: document.querySelector("#closeHabitDialogButton"),
  templateButtons: [...document.querySelectorAll(".template-chip")],
  deleteHabitButton: document.querySelector("#deleteHabitButton"),
  habitForm: document.querySelector("#habitForm"),
  habitName: document.querySelector("#habitName"),
  habitArea: document.querySelector("#habitArea"),
  habitColor: document.querySelector("#habitColor"),
  habitMinimum: document.querySelector("#habitMinimum"),
  habitCue: document.querySelector("#habitCue"),
  habitReward: document.querySelector("#habitReward"),
  habitEnvironment: document.querySelector("#habitEnvironment"),
  habitFrequency: document.querySelector("#habitFrequency"),
  habitTarget: document.querySelector("#habitTarget"),
  weekdayPicker: document.querySelector("#weekdayPicker"),
  weekdayInputs: [...document.querySelectorAll("#weekdayPicker input")],
  habitFriction: document.querySelector("#habitFriction"),
  habitDecay: document.querySelector("#habitDecay"),
  frictionOutput: document.querySelector("#frictionOutput"),
  decayOutput: document.querySelector("#decayOutput"),
  resetFormButton: document.querySelector("#resetFormButton"),
  forestCanvas: document.querySelector("#forestCanvas"),
  forestHud: document.querySelector("#forestHud"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  strengthMetric: document.querySelector("#strengthMetric"),
  strengthCaption: document.querySelector("#strengthCaption"),
  streakMetric: document.querySelector("#streakMetric"),
  streakCaption: document.querySelector("#streakCaption"),
  repetitionMetric: document.querySelector("#repetitionMetric"),
  repetitionCaption: document.querySelector("#repetitionCaption"),
  decayMetric: document.querySelector("#decayMetric"),
  decayCaption: document.querySelector("#decayCaption"),
  calendarGrid: document.querySelector("#calendarGrid"),
  loopCard: document.querySelector("#loopCard"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate"),
};

init();

function init() {
  const today = getTodayISO();
  elements.journalDate.value = today;
  elements.journalDate.max = today;

  bindEvents();
  fillForm(getHabit(editingId));
  render();
  startCanvas();
  setupCloudAuth();
}

function bindEvents() {
  elements.journalDate.addEventListener("change", () => {
    render();
  });

  elements.googleSignInButton.addEventListener("click", signInWithGoogle);
  elements.signOutButton.addEventListener("click", signOutOfGoogle);
  elements.syncLocalButton.addEventListener("click", syncLocalSnapshotToCloud);
  elements.profileButton.addEventListener("click", toggleProfilePopover);
  document.addEventListener("click", closeProfilePopoverOnOutsideClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProfilePopover();
  });

  elements.newHabitButton.addEventListener("click", () => {
    editingId = null;
    fillForm(null);
    renderHabitList();
    renderDeleteButton();
    openHabitDialog();
  });

  elements.editHabitButton.addEventListener("click", () => {
    const habit = getSelectedHabit();
    if (!habit) {
      editingId = null;
      fillForm(null);
    } else {
      editingId = habit.id;
      fillForm(habit);
    }
    renderDeleteButton();
    openHabitDialog();
  });

  elements.closeHabitDialogButton.addEventListener("click", closeHabitDialog);

  elements.habitDialog.addEventListener("click", (event) => {
    if (event.target === elements.habitDialog) closeHabitDialog();
  });

  elements.templateButtons.forEach((button) => {
    button.addEventListener("click", () => applyHabitTemplate(button.dataset.template));
  });

  elements.resetFormButton.addEventListener("click", () => {
    fillForm(getHabit(editingId));
  });

  elements.deleteHabitButton.addEventListener("click", () => {
    const habit = getHabit(editingId);
    if (!habit) return;

    const shouldDelete = window.confirm(`Excluir a rota "${habit.name}"?`);
    if (!shouldDelete) return;

    state.habits = state.habits.filter((item) => item.id !== habit.id);
    if (state.selectedHabitId === habit.id) {
      state.selectedHabitId = state.habits[0]?.id || null;
    }
    editingId = state.selectedHabitId;
    saveState();
    fillForm(getHabit(editingId));
    render();
    closeHabitDialog();
    showToast("Rota removida da floresta.");
  });

  elements.habitList.addEventListener("click", (event) => {
    const card = event.target.closest("[data-habit-id]");
    if (!card) return;
    selectHabit(card.dataset.habitId);
  });

  elements.todayList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-check-id]");
    if (!button) return;
    toggleLog(button.dataset.checkId, elements.journalDate.value);
  });

  elements.calendarGrid.addEventListener("click", (event) => {
    const dayButton = event.target.closest("[data-date]");
    const habit = getSelectedHabit();
    if (!dayButton || !habit || dayButton.disabled) return;
    toggleLog(habit.id, dayButton.dataset.date);
  });

  elements.habitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = readForm();
    if (!data.name.trim()) {
      elements.habitName.focus();
      return;
    }

    const existing = getHabit(editingId);
    if (existing) {
      Object.assign(existing, data);
      state.selectedHabitId = existing.id;
      showToast("Rota atualizada.");
    } else {
      const newHabit = {
        ...data,
        id: createId(),
        createdAt: elements.journalDate.value || getTodayISO(),
        logs: {},
      };
      state.habits.unshift(newHabit);
      state.selectedHabitId = newHabit.id;
      editingId = newHabit.id;
      showToast("Nova rota plantada.");
    }

    saveState();
    fillForm(getHabit(editingId));
    render();
    closeHabitDialog();
  });

  elements.habitFrequency.addEventListener("change", updateWeekdayVisibility);
  elements.habitFriction.addEventListener("input", updateRangeOutputs);
  elements.habitDecay.addEventListener("input", updateRangeOutputs);

  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.viewMode = button.dataset.view;
      saveState();
      renderTabs();
      renderHud();
    });
  });

  window.addEventListener("resize", () => {
    lastCanvasSize = "";
  });
}

function loadState() {
  const fallback = createSeedState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return normalizeStoredState(parsed);
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
  scheduleCloudSave();
  renderAuthPanel();
}

function serializeState(source = state) {
  return {
    habits: Array.isArray(source.habits) ? source.habits.map((habit) => ({ ...habit, logs: { ...(habit.logs || {}) } })) : [],
    selectedHabitId: source.selectedHabitId || null,
    viewMode: source.viewMode === "overview" ? "overview" : "selected",
  };
}

function clonePlainState(source = state) {
  return JSON.parse(JSON.stringify(serializeState(source)));
}

function normalizeStoredState(payload) {
  const habits = Array.isArray(payload?.habits) ? payload.habits.map(normalizeHabit) : [];
  return {
    habits,
    selectedHabitId: habits.some((habit) => habit.id === payload?.selectedHabitId)
      ? payload.selectedHabitId
      : habits[0]?.id || null,
    viewMode: payload?.viewMode === "overview" ? "overview" : "selected",
  };
}

async function setupCloudAuth() {
  renderAuthPanel();

  if (!firebaseSettings.enabled) {
    cloud.status = "local";
    cloud.message = "Modo local ativo. Preencha firebase-config.js para ativar contas Google.";
    renderAuthPanel();
    return;
  }

  if (!isFirebaseConfigComplete(firebaseSettings.config)) {
    cloud.status = "error";
    cloud.message = "Firebase está ativado, mas a configuração está incompleta.";
    renderAuthPanel();
    return;
  }

  try {
    cloud.enabled = true;
    cloud.status = "syncing";
    cloud.message = "Conectando ao Firebase...";
    renderAuthPanel();

    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`${FIREBASE_SDK_BASE}/firebase-app.js`),
      import(`${FIREBASE_SDK_BASE}/firebase-auth.js`),
      import(`${FIREBASE_SDK_BASE}/firebase-firestore.js`),
    ]);

    const firebaseApp = appModule.initializeApp(firebaseSettings.config);
    cloud.auth = authModule.getAuth(firebaseApp);
    cloud.db = firestoreModule.getFirestore(firebaseApp);
    cloud.provider = new authModule.GoogleAuthProvider();
    cloud.modules = { auth: authModule, firestore: firestoreModule };

    await authModule.setPersistence(cloud.auth, authModule.browserLocalPersistence);

    authModule.onAuthStateChanged(
      cloud.auth,
      handleAuthUserChange,
      (error) => {
        cloud.status = "error";
        cloud.message = getFirebaseErrorMessage(error);
        renderAuthPanel();
      },
    );

    cloud.status = cloud.auth.currentUser ? "syncing" : "ready";
    cloud.message = cloud.auth.currentUser ? "Carregando sua conta..." : "Entre com Google para sincronizar.";
    renderAuthPanel();
  } catch (error) {
    cloud.enabled = false;
    cloud.status = "error";
    cloud.message = "Não consegui carregar o Firebase. Confira a conexão e a configuração.";
    console.error(error);
    renderAuthPanel();
  }
}

async function handleAuthUserChange(user) {
  disconnectCloudDoc();
  cloud.user = user || null;

  if (!user) {
    cloud.status = cloud.enabled ? "ready" : "local";
    cloud.message = cloud.enabled ? "Entre com Google para sincronizar." : "Dados salvos neste navegador.";
    renderAuthPanel();
    return;
  }

  try {
    cloud.status = "syncing";
    cloud.message = "Carregando sua floresta na nuvem...";
    renderAuthPanel();

    const { doc, getDoc, onSnapshot } = cloud.modules.firestore;
    cloud.docRef = doc(cloud.db, "users", user.uid, "private", "forestRoads");
    const snapshot = await getDoc(cloud.docRef);

    if (snapshot.exists() && snapshot.data()?.state) {
      applyCloudState(snapshot.data().state);
      cloud.message = "Dados carregados da sua conta Google.";
    } else {
      await writeCloudState();
      cloud.message = "Sua floresta local foi enviada para a conta.";
    }

    cloud.unsubscribe = onSnapshot(
      cloud.docRef,
      (docSnapshot) => {
        if (!docSnapshot.exists() || docSnapshot.metadata?.hasPendingWrites) return;
        const remoteState = docSnapshot.data()?.state;
        if (remoteState) applyCloudState(remoteState);
        cloud.status = "synced";
        cloud.message = "Sincronizado com sua conta Google.";
        renderAuthPanel();
      },
      (error) => {
        cloud.status = "error";
        cloud.message = getFirebaseErrorMessage(error);
        renderAuthPanel();
      },
    );

    cloud.status = "synced";
    renderAuthPanel();
  } catch (error) {
    cloud.status = "error";
    cloud.message = getFirebaseErrorMessage(error);
    renderAuthPanel();
  }
}

function disconnectCloudDoc() {
  if (cloud.unsubscribe) {
    cloud.unsubscribe();
    cloud.unsubscribe = null;
  }
  cloud.docRef = null;
  window.clearTimeout(cloud.saveTimer);
}

function applyCloudState(remoteState) {
  const incoming = normalizeStoredState(remoteState);
  cloud.suppressSave = true;
  state.habits = incoming.habits;
  state.selectedHabitId = incoming.selectedHabitId;
  state.viewMode = incoming.viewMode;
  editingId = state.selectedHabitId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
  fillForm(getHabit(editingId));
  render();
  cloud.suppressSave = false;
}

function scheduleCloudSave() {
  if (cloud.suppressSave || !cloud.user || !cloud.docRef || !cloud.modules?.firestore) return;

  cloud.status = "pending";
  cloud.message = "Alterações locais aguardando sincronização...";
  window.clearTimeout(cloud.saveTimer);
  cloud.saveTimer = window.setTimeout(writeCloudState, 650);
}

async function writeCloudState() {
  if (!cloud.user || !cloud.docRef || !cloud.modules?.firestore) return;

  try {
    cloud.status = "syncing";
    cloud.message = "Sincronizando alterações...";
    renderAuthPanel();

    const { setDoc, serverTimestamp } = cloud.modules.firestore;
    await setDoc(
      cloud.docRef,
      {
        version: CLOUD_DOC_VERSION,
        updatedAt: serverTimestamp(),
        state: serializeState(),
      },
      { merge: true },
    );

    cloud.status = "synced";
    cloud.lastSavedAt = new Date();
    cloud.message = "Sincronizado com sua conta Google.";
    renderAuthPanel();
  } catch (error) {
    cloud.status = "error";
    cloud.message = getFirebaseErrorMessage(error);
    renderAuthPanel();
  }
}

async function signInWithGoogle() {
  if (!cloud.enabled || !cloud.auth || !cloud.provider) {
    showToast("Preencha firebase-config.js para ativar o login com Google.");
    return;
  }

  try {
    cloud.status = "syncing";
    cloud.message = "Abrindo login do Google...";
    renderAuthPanel();
    await cloud.modules.auth.signInWithPopup(cloud.auth, cloud.provider);
  } catch (error) {
    if (error?.code === "auth/popup-blocked") {
      await cloud.modules.auth.signInWithRedirect(cloud.auth, cloud.provider);
      return;
    }

    cloud.status = "ready";
    cloud.message = getFirebaseErrorMessage(error);
    renderAuthPanel();
    showToast(cloud.message);
  }
}

async function signOutOfGoogle() {
  if (!cloud.auth || !cloud.modules?.auth) return;

  try {
    await cloud.modules.auth.signOut(cloud.auth);
    showToast("Você saiu da conta Google. O app voltou ao modo local.");
  } catch (error) {
    showToast(getFirebaseErrorMessage(error));
  }
}

async function syncLocalSnapshotToCloud() {
  if (!cloud.user || !cloud.docRef) {
    showToast("Entre com Google antes de enviar dados locais.");
    return;
  }

  const merged = mergeStoredStates(serializeState(), localStateSnapshotAtBoot);
  cloud.suppressSave = true;
  state.habits = merged.habits;
  state.selectedHabitId = merged.selectedHabitId;
  state.viewMode = merged.viewMode;
  editingId = state.selectedHabitId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
  fillForm(getHabit(editingId));
  render();
  cloud.suppressSave = false;

  await writeCloudState();
  showToast("Dados locais enviados para a conta Google.");
}

function mergeStoredStates(baseState, incomingState) {
  const byId = new Map();
  const base = normalizeStoredState(baseState);
  const incoming = normalizeStoredState(incomingState);

  base.habits.forEach((habit) => byId.set(habit.id, habit));
  incoming.habits.forEach((habit) => byId.set(habit.id, habit));

  return normalizeStoredState({
    habits: [...byId.values()],
    selectedHabitId: incoming.selectedHabitId || base.selectedHabitId,
    viewMode: incoming.viewMode || base.viewMode,
  });
}

function renderAuthPanel() {
  if (!elements.syncBadge) return;

  const signedIn = Boolean(cloud.user);
  const displayName = cloud.user?.displayName || "Conta Google";
  const email = cloud.user?.email || "";
  const initials = signedIn ? getInitials(displayName || email) : "FR";
  const badgeLabel = getCloudBadgeLabel();

  elements.syncBadge.textContent = badgeLabel;
  elements.syncBadge.className = `sync-badge is-${cloud.status}`;
  elements.accountName.textContent = signedIn ? displayName : cloud.enabled ? "Conta Google" : "Modo local";
  elements.accountEmail.textContent = signedIn ? email : cloud.message;
  elements.accountAvatar.textContent = cloud.user?.photoURL ? "" : initials;
  elements.accountAvatar.style.backgroundImage = cloud.user?.photoURL ? `url("${cloud.user.photoURL}")` : "";
  elements.googleSignInButton.hidden = signedIn;
  elements.googleSignInButton.disabled = !cloud.enabled || cloud.status === "syncing";
  elements.googleSignInButton.innerHTML = cloud.enabled ? `${GOOGLE_ICON}Entrar com Google` : "Configurar Firebase";
  elements.signOutButton.hidden = !signedIn;
  elements.syncLocalButton.hidden = !signedIn;
  elements.syncStatus.textContent = getCloudStatusText();
}

function getCloudBadgeLabel() {
  if (cloud.status === "synced") return "Nuvem";
  if (cloud.status === "syncing") return "Sincronizando";
  if (cloud.status === "pending") return "Pendente";
  if (cloud.status === "ready") return "Google";
  if (cloud.status === "error") return "Atenção";
  return "Local";
}

function getCloudStatusText() {
  if (cloud.lastSavedAt && cloud.status === "synced") {
    return `Última sincronização: ${cloud.lastSavedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
  }
  return cloud.message;
}

function isFirebaseConfigComplete(config) {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}

function getFirebaseErrorMessage(error) {
  const code = error?.code || "";
  if (code === "auth/popup-closed-by-user") return "Login cancelado antes de terminar.";
  if (code === "auth/unauthorized-domain") return "Este domínio ainda não está autorizado no Firebase.";
  if (code === "permission-denied") return "O Firestore recusou acesso. Confira as regras de segurança.";
  return "Não foi possível sincronizar agora. Confira Firebase, internet e permissões.";
}

function createSeedState() {
  const today = getTodayISO();
  const samples = [
    {
      ...DEFAULT_FORM,
      id: createId("walk"),
      name: "Caminhar 10 minutos",
      area: "corpo",
      color: "#d28a3c",
      minimum: "calçar o tênis e sair de casa",
      cue: "depois do primeiro copo de agua",
      reward: "banho e check-in no mapa",
      environment: "tênis visível perto da porta",
      frequency: "daily",
      target: 66,
      friction: 2,
      decay: 3,
      createdAt: addDays(today, -54),
      logs: {},
    },
    {
      ...DEFAULT_FORM,
      id: createId("read"),
      name: "Ler antes de dormir",
      area: "mente",
      color: "#8ab5c4",
      minimum: "duas páginas",
      cue: "celular no carregador",
      reward: "marcar a página com uma frase",
      environment: "livro aberto na mesa de cabeceira",
      frequency: "daily",
      target: 66,
      friction: 3,
      decay: 4,
      createdAt: addDays(today, -38),
      logs: {},
    },
    {
      ...DEFAULT_FORM,
      id: createId("focus"),
      name: "Bloco de foco profundo",
      area: "foco",
      color: "#8f4d68",
      minimum: "15 minutos sem abas extras",
      cue: "primeiro horario livre da manha",
      reward: "cafe sem tela por 5 minutos",
      environment: "notificações desligadas",
      frequency: "weekdays",
      target: 50,
      friction: 4,
      decay: 3,
      createdAt: addDays(today, -30),
      logs: {},
    },
  ];

  samples.forEach((habit, sampleIndex) => {
    for (let offset = diffDays(habit.createdAt, today); offset >= 0; offset -= 1) {
      const iso = addDays(today, -offset);
      if (!isHabitDue(habit, iso)) continue;
      const dayNumber = diffDays(habit.createdAt, iso) + sampleIndex;
      const shouldSkip =
        sampleIndex === 0
          ? dayNumber % 11 === 0 || dayNumber % 17 === 0
          : sampleIndex === 1
            ? dayNumber % 4 === 0 || dayNumber % 13 === 0
            : dayNumber % 7 === 0 || dayNumber % 9 === 0;
      if (!shouldSkip) habit.logs[iso] = "done";
    }
  });

  return {
    habits: samples,
    selectedHabitId: samples[0].id,
    viewMode: "selected",
  };
}

function normalizeHabit(habit) {
  return {
    ...DEFAULT_FORM,
    ...habit,
    id: String(habit.id || createId()),
    name: String(habit.name || "Novo hábito"),
    color: isColor(habit.color) ? habit.color : DEFAULT_FORM.color,
    target: clamp(Number(habit.target) || 66, 7, 180),
    friction: clamp(Number(habit.friction) || 3, 1, 5),
    decay: clamp(Number(habit.decay) || 3, 1, 5),
    weekdays: Array.isArray(habit.weekdays) ? habit.weekdays.map(Number) : DEFAULT_FORM.weekdays,
    createdAt: habit.createdAt || getTodayISO(),
    logs: habit.logs && typeof habit.logs === "object" ? habit.logs : {},
  };
}

function render() {
  renderTabs();
  renderTodayList();
  renderHabitList();
  renderMetrics();
  renderCalendar();
  renderLoopCard();
  renderHud();
  renderDeleteButton();
}

function renderTabs() {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.viewMode);
  });
}

function renderTodayList() {
  const date = elements.journalDate.value || getTodayISO();
  elements.todayList.innerHTML = "";

  if (!state.habits.length) {
    elements.todayList.appendChild(elements.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  state.habits.forEach((habit) => {
    const status = getStatus(habit, date);
    const isDone = habit.logs[date] === "done";
    const item = document.createElement("article");
    item.className = "today-item";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = habit.name;
    const meta = document.createElement("span");
    meta.textContent = getTodayMeta(habit, date, status);
    text.append(title, meta);

    const button = document.createElement("button");
    button.className = `check-button${isDone ? " is-done" : ""}`;
    button.type = "button";
    button.dataset.checkId = habit.id;
    button.setAttribute("aria-label", isDone ? `Remover check-in de ${habit.name}` : `Registrar check-in de ${habit.name}`);
    button.title = isDone ? "Remover check-in" : "Registrar check-in";
    button.innerHTML = isDone
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>';

    item.append(text, button);
    elements.todayList.appendChild(item);
  });
}

function renderHabitList() {
  elements.habitList.innerHTML = "";

  if (!state.habits.length) {
    elements.habitList.appendChild(elements.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  state.habits.forEach((habit) => {
    const stats = computeStats(habit);
    const stage = getStage(stats.strength);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `habit-card${habit.id === state.selectedHabitId ? " is-active" : ""}`;
    card.dataset.habitId = habit.id;
    card.style.setProperty("--route-color", habit.color);
    card.style.setProperty("--progress", `${Math.round(stats.strength)}%`);
    card.innerHTML = `
      <div class="habit-card-content">
        <div class="habit-topline">
          <span class="habit-title">${escapeHTML(habit.name)}</span>
          <span class="habit-stage">${stage.label}</span>
        </div>
        <div class="progress-track" aria-hidden="true"><div class="progress-fill"></div></div>
        <span class="habit-meta">${AREA_LABELS[habit.area] || "Rotina"} · ${stats.doneCount} rep. · ${stats.consistencyLabel}</span>
      </div>
    `;
    elements.habitList.appendChild(card);
  });
}

function renderMetrics() {
  const habit = getSelectedHabit();
  const stats = habit ? computeStats(habit) : null;
  const stage = stats ? getStage(stats.strength) : null;

  elements.strengthMetric.textContent = stats ? `${Math.round(stats.strength)}%` : "0%";
  elements.strengthCaption.textContent = stage ? stage.caption : "Sem trilha ativa";

  elements.streakMetric.textContent = stats ? `${stats.streak} dias` : "0 dias";
  elements.streakCaption.textContent = stats ? "Sequência em dias devidos" : "Consistência atual";

  elements.repetitionMetric.textContent = stats ? String(stats.doneCount) : "0";
  elements.repetitionCaption.textContent = stats
    ? `${Math.round(stats.automationProgress)}% da meta de ${habit.target}`
    : "Rumo à automação";

  elements.decayMetric.textContent = stats ? `${Math.round(stats.decayPressure)}%` : "0%";
  elements.decayCaption.textContent = stats ? stats.decayCaption : "Pressão por pausas";
}

function renderCalendar() {
  const habit = getSelectedHabit();
  const endDate = elements.journalDate.value || getTodayISO();
  const today = getTodayISO();
  elements.calendarGrid.innerHTML = "";

  if (!habit) {
    elements.calendarGrid.appendChild(elements.emptyStateTemplate.content.cloneNode(true));
    return;
  }

  getDateRange(addDays(endDate, -34), endDate).forEach((iso) => {
    const status = getStatus(habit, iso);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-cell ${status}${iso === today ? " today" : ""}`;
    button.dataset.date = iso;
    button.disabled = compareISO(iso, today) > 0;
    button.setAttribute("aria-label", `${formatLongDate(iso)}: ${statusLabel(status)}`);
    button.innerHTML = `
      <span>${formatWeekday(iso)}</span>
      <strong>${fromISO(iso).getDate()}</strong>
    `;
    elements.calendarGrid.appendChild(button);
  });
}

function renderLoopCard() {
  const habit = getSelectedHabit();

  if (!habit) {
    elements.loopCard.innerHTML = "<strong>Loop do hábito</strong><span>Selecione ou crie uma rota.</span>";
    return;
  }

  elements.loopCard.innerHTML = `
    <strong>${escapeHTML(habit.name)}</strong>
    <div class="loop-grid">
      <div class="loop-item"><b>Gatilho</b><span>${escapeHTML(habit.cue || "Contexto ainda não definido")}</span></div>
      <div class="loop-item"><b>Rotina</b><span>${escapeHTML(habit.minimum || "A menor ação possível")}</span></div>
      <div class="loop-item"><b>Recompensa</b><span>${escapeHTML(habit.reward || "Reforço imediato")}</span></div>
    </div>
    <div class="loop-item"><b>Ambiente</b><span>${escapeHTML(habit.environment || "Remova fricções e deixe a pista visível")}</span></div>
  `;
}

function renderHud() {
  const habit = getSelectedHabit();

  if (state.viewMode === "overview") {
    const stats = state.habits.map(computeStats);
    const average = stats.length ? stats.reduce((sum, item) => sum + item.strength, 0) / stats.length : 0;
    const doneToday = state.habits.filter((habitItem) => habitItem.logs[getTodayISO()] === "done").length;
    elements.forestHud.innerHTML = `
      <div class="hud-card">
        <strong>Todas as rotas · ${state.habits.length} hábitos</strong>
        <span>Cada estrada segue um desenho próprio. Rotas fortes abrem clareiras; rotas pausadas recebem brotos e galhos sobre o caminho.</span>
      </div>
      <div class="hud-pill">${doneToday}/${state.habits.length || 0} hoje · ${Math.round(average)}% médio</div>
    `;
    return;
  }

  if (!habit) {
    elements.forestHud.innerHTML = `
      <div class="hud-card">
        <strong>Floresta sem rota selecionada</strong>
        <span>Crie um hábito para a paisagem começar a reagir aos seus check-ins.</span>
      </div>
      <div class="hud-pill">0%</div>
    `;
    return;
  }

  const stats = computeStats(habit);
  const stage = getStage(stats.strength);
  elements.forestHud.innerHTML = `
    <div class="hud-card">
      <strong>${escapeHTML(habit.name)} · ${stage.label}</strong>
      <span>${stage.caption} ${stats.doneCount} repetições registradas; ${stats.missedRecent} pausas recentes deixam a vegetação mais insistente.</span>
    </div>
    <div class="hud-pill">${Math.round(stats.strength)}% aberto</div>
  `;
}

function renderDeleteButton() {
  const exists = Boolean(getHabit(editingId));
  elements.deleteHabitButton.disabled = !exists;
  elements.deleteHabitButton.style.visibility = exists ? "visible" : "hidden";
  elements.editHabitButton.disabled = !getSelectedHabit();
}

function selectHabit(id) {
  state.selectedHabitId = id;
  editingId = id;
  saveState();
  fillForm(getHabit(id));
  render();
}

function openHabitDialog() {
  if (typeof elements.habitDialog.showModal === "function") {
    elements.habitDialog.showModal();
  } else {
    elements.habitDialog.setAttribute("open", "");
  }
  window.setTimeout(() => elements.habitName.focus(), 60);
}

function closeHabitDialog() {
  if (elements.habitDialog.open) {
    elements.habitDialog.close();
  } else {
    elements.habitDialog.removeAttribute("open");
  }
}

function toggleProfilePopover(event) {
  event.stopPropagation();
  const willOpen = elements.profilePopover.hidden;
  elements.profilePopover.hidden = !willOpen;
  elements.profileButton.setAttribute("aria-expanded", String(willOpen));
}

function closeProfilePopover() {
  elements.profilePopover.hidden = true;
  elements.profileButton.setAttribute("aria-expanded", "false");
}

function closeProfilePopoverOnOutsideClick(event) {
  if (elements.profilePopover.hidden) return;
  if (event.target.closest(".profile-menu")) return;
  closeProfilePopover();
}

function applyHabitTemplate(template) {
  const templates = {
    corpo: {
      area: "corpo",
      color: "#d28a3c",
      minimum: "calçar o tênis e começar por 5 minutos",
      cue: "depois do primeiro copo de água",
      reward: "marcar a rota no mapa",
      environment: "deixar roupa ou tênis visível",
      friction: 2,
      decay: 3,
    },
    mente: {
      area: "mente",
      color: "#8ab5c4",
      minimum: "abrir o livro ou meditar por 2 minutos",
      cue: "depois de desligar uma tela",
      reward: "anotar uma frase curta",
      environment: "deixar o material pronto no local certo",
      friction: 3,
      decay: 4,
    },
    foco: {
      area: "foco",
      color: "#8f4d68",
      minimum: "15 minutos sem abas extras",
      cue: "primeiro bloco livre do dia",
      reward: "pausa curta sem tela",
      environment: "notificações desligadas",
      frequency: "weekdays",
      friction: 4,
      decay: 3,
    },
    estudo: {
      area: "estudo",
      color: "#7fa861",
      minimum: "resolver uma questão ou revisar uma página",
      cue: "após organizar a mesa",
      reward: "registrar o avanço no mapa",
      environment: "deixar caderno e material abertos",
      frequency: "weekdays",
      friction: 3,
      decay: 3,
    },
  };

  const data = templates[template];
  if (!data) return;

  if (!elements.habitName.value.trim()) {
    const names = {
      corpo: "Movimento diário",
      mente: "Cuidar da mente",
      foco: "Bloco de foco",
      estudo: "Estudo consistente",
    };
    elements.habitName.value = names[template] || "";
  }

  elements.habitArea.value = data.area || elements.habitArea.value;
  elements.habitColor.value = data.color || elements.habitColor.value;
  elements.habitMinimum.value = data.minimum || elements.habitMinimum.value;
  elements.habitCue.value = data.cue || elements.habitCue.value;
  elements.habitReward.value = data.reward || elements.habitReward.value;
  elements.habitEnvironment.value = data.environment || elements.habitEnvironment.value;
  elements.habitFrequency.value = data.frequency || elements.habitFrequency.value;
  elements.habitFriction.value = data.friction || elements.habitFriction.value;
  elements.habitDecay.value = data.decay || elements.habitDecay.value;
  updateWeekdayVisibility();
  updateRangeOutputs();
}

function fillForm(habit) {
  const data = habit || DEFAULT_FORM;
  elements.habitName.value = data.name;
  elements.habitArea.value = data.area;
  elements.habitColor.value = data.color;
  elements.habitMinimum.value = data.minimum;
  elements.habitCue.value = data.cue;
  elements.habitReward.value = data.reward;
  elements.habitEnvironment.value = data.environment;
  elements.habitFrequency.value = data.frequency;
  elements.habitTarget.value = data.target;
  elements.habitFriction.value = data.friction;
  elements.habitDecay.value = data.decay;

  const weekdays = new Set(data.weekdays || DEFAULT_FORM.weekdays);
  elements.weekdayInputs.forEach((input) => {
    input.checked = weekdays.has(Number(input.value));
  });

  updateWeekdayVisibility();
  updateRangeOutputs();
}

function readForm() {
  const frequency = elements.habitFrequency.value;
  const checkedDays = elements.weekdayInputs.filter((input) => input.checked).map((input) => Number(input.value));

  return {
    name: elements.habitName.value.trim(),
    area: elements.habitArea.value,
    color: elements.habitColor.value,
    minimum: elements.habitMinimum.value.trim(),
    cue: elements.habitCue.value.trim(),
    reward: elements.habitReward.value.trim(),
    environment: elements.habitEnvironment.value.trim(),
    frequency,
    weekdays: frequency === "custom" ? checkedDays.length ? checkedDays : [fromISO(getTodayISO()).getDay()] : DEFAULT_FORM.weekdays,
    target: clamp(Number(elements.habitTarget.value) || 66, 7, 180),
    friction: clamp(Number(elements.habitFriction.value) || 3, 1, 5),
    decay: clamp(Number(elements.habitDecay.value) || 3, 1, 5),
  };
}

function updateWeekdayVisibility() {
  const isCustom = elements.habitFrequency.value === "custom";
  elements.weekdayPicker.classList.toggle("is-visible", isCustom);
}

function updateRangeOutputs() {
  elements.frictionOutput.value = elements.habitFriction.value;
  elements.frictionOutput.textContent = elements.habitFriction.value;
  elements.decayOutput.value = elements.habitDecay.value;
  elements.decayOutput.textContent = elements.habitDecay.value;
}

function toggleLog(habitId, iso) {
  const habit = getHabit(habitId);
  if (!habit || compareISO(iso, getTodayISO()) > 0) return;

  if (habit.logs[iso] === "done") {
    delete habit.logs[iso];
    showToast("Check-in removido. A mata percebe a pausa.");
  } else {
    habit.logs[iso] = "done";
    showToast("Check-in registrado. A rota abriu mais um pouco.");
  }

  if (compareISO(iso, habit.createdAt) < 0) {
    habit.createdAt = iso;
  }

  saveState();
  render();
}

function computeStats(habit) {
  const today = getTodayISO();
  const createdAt = minISO(habit.createdAt, today);
  const allDates = getDateRange(createdAt, today);
  const yesterday = addDays(today, -1);
  const recentStart = addDays(today, -13);
  let dueCount = 0;
  let doneDueCount = 0;
  let doneCount = 0;
  let missedCount = 0;
  let missedRecent = 0;
  let recentDue = 0;
  let recentDone = 0;
  let lastDone = null;

  allDates.forEach((iso) => {
    const done = habit.logs[iso] === "done";
    const due = isHabitDue(habit, iso);
    if (done) {
      doneCount += 1;
      lastDone = iso;
    }
    if (due) {
      dueCount += 1;
      if (done) {
        doneDueCount += 1;
      } else if (compareISO(iso, today) < 0) {
        missedCount += 1;
      }
    }
    if (compareISO(iso, recentStart) >= 0 && compareISO(iso, today) < 0 && due) {
      recentDue += 1;
      if (done) recentDone += 1;
      else missedRecent += 1;
    }
  });

  const streak = computeStreak(habit, today);
  const gapMisses = computeGapMisses(habit, lastDone, yesterday);
  const consistency = recentDue ? recentDone / recentDue : doneCount ? 1 : 0;
  const automationProgress = clamp((doneCount / habit.target) * 100, 0, 100);
  const repetitionPower = automationProgress * 0.76;
  const streakBonus = Math.min(16, streak * 1.6);
  const consistencyBonus = consistency * 8;
  const decayPressure = clamp(missedRecent * habit.decay * 2.2 + gapMisses * habit.decay * 1.15, 0, 100);
  const frictionDrag = (habit.friction - 1) * 2.4;
  const strength = doneCount
    ? clamp(repetitionPower + streakBonus + consistencyBonus + 4 - decayPressure - frictionDrag, 0, 100)
    : 0;

  return {
    dueCount,
    doneDueCount,
    doneCount,
    missedCount,
    missedRecent,
    streak,
    consistency,
    consistencyLabel: `${Math.round(consistency * 100)}% nos últimos dias`,
    automationProgress,
    decayPressure,
    decayCaption:
      decayPressure < 10
        ? "Vegetação sob controle"
        : decayPressure < 34
          ? "Alguns brotos voltando"
          : "A floresta está recuperando espaço",
    strength,
    roadLength: clamp(0.1 + strength / 100 - decayPressure / 250, 0.06, 1),
    roadWidth: 4 + strength * 0.46,
    density: clamp(1 - strength / 120 + decayPressure / 120, 0.16, 1.15),
  };
}

function computeStreak(habit, today) {
  let cursor = today;
  let streak = 0;

  if (isHabitDue(habit, cursor) && habit.logs[cursor] !== "done") {
    cursor = addDays(cursor, -1);
  }

  while (compareISO(cursor, habit.createdAt) >= 0) {
    if (!isHabitDue(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (habit.logs[cursor] === "done") {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }

  return streak;
}

function computeGapMisses(habit, lastDone, untilDate) {
  if (!lastDone) return 0;
  let cursor = addDays(lastDone, 1);
  let misses = 0;

  while (compareISO(cursor, untilDate) <= 0) {
    if (isHabitDue(habit, cursor) && habit.logs[cursor] !== "done") misses += 1;
    cursor = addDays(cursor, 1);
  }

  return misses;
}

function getStatus(habit, iso) {
  if (habit.logs[iso] === "done") return "done";
  if (!isHabitDue(habit, iso)) return "free";
  if (compareISO(iso, getTodayISO()) < 0) return "missed";
  return "open";
}

function getTodayMeta(habit, iso, status) {
  if (status === "done") return isHabitDue(habit, iso) ? "rota reforçada neste dia" : "repetição extra registrada";
  if (status === "missed") return "pausa: a floresta ganhou espaço";
  if (status === "free") return "dia livre na frequência";
  return habit.minimum || "ação mínima ainda não definida";
}

function statusLabel(status) {
  if (status === "done") return "feito";
  if (status === "missed") return "pausa";
  if (status === "free") return "dia livre";
  return "pendente";
}

function isHabitDue(habit, iso) {
  if (compareISO(iso, habit.createdAt) < 0) return false;
  const day = fromISO(iso).getDay();
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekdays") return day >= 1 && day <= 5;
  if (habit.frequency === "custom") return (habit.weekdays || []).map(Number).includes(day);
  return true;
}

function getSelectedHabit() {
  return getHabit(state.selectedHabitId);
}

function getHabit(id) {
  return state.habits.find((habit) => habit.id === id) || null;
}

function getStage(score) {
  return STAGES.find((stage) => score <= stage.max) || STAGES[STAGES.length - 1];
}

function startCanvas() {
  const ctx = elements.forestCanvas.getContext("2d");

  const draw = (time) => {
    resizeCanvas();
    drawForest(ctx, time / 1000);
    animationFrame = requestAnimationFrame(draw);
  };

  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(draw);
}

function resizeCanvas() {
  const canvas = elements.forestCanvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const sizeKey = `${Math.round(rect.width)}x${Math.round(rect.height)}@${dpr}`;
  if (sizeKey === lastCanvasSize) return;

  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  lastCanvasSize = sizeKey;
}

function drawForest(ctx, time) {
  const canvas = elements.forestCanvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  drawGround(ctx, width, height, time);

  if (state.viewMode === "overview") {
    drawOverview(ctx, width, height, time);
  } else {
    drawSelectedRoad(ctx, width, height, time);
  }

  drawAtmosphere(ctx, width, height, time);
}

function drawGround(ctx, width, height, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#27443e");
  gradient.addColorStop(0.38, "#1f392b");
  gradient.addColorStop(1, "#111b16");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const rng = seededRandom("ground-texture");
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 360; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    const len = 7 + rng() * 28;
    const hue = rng() > 0.55 ? "rgba(190, 207, 160, 0.42)" : "rgba(68, 104, 67, 0.58)";
    ctx.strokeStyle = hue;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(rng() * Math.PI) * len, y + Math.sin(rng() * Math.PI) * len * 0.35);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  const light = ctx.createRadialGradient(width * 0.5, height * 0.28, 20, width * 0.5, height * 0.28, width * 0.75);
  light.addColorStop(0, "rgba(241, 208, 157, 0.18)");
  light.addColorStop(0.55, "rgba(138, 181, 196, 0.08)");
  light.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.12 + Math.sin(time * 0.4) * 0.02;
  ctx.fillStyle = "#dcebc8";
  for (let i = 0; i < 12; i += 1) {
    const y = height * (0.14 + i * 0.065);
    ctx.fillRect(0, y, width, 1);
  }
  ctx.restore();
}

function drawOverview(ctx, width, height, time) {
  const habits = state.habits;
  const forestDensity = habits.length ? 0.72 : 1;
  drawTrees(ctx, width, height, [], forestDensity, "overview-base", time);

  habits.forEach((habit, index) => {
    const stats = computeStats(habit);
    const points = createPathPoints(habit, width, height, index, habits.length, true);
    const partial = getPartialPath(points, stats.roadLength);
    drawRoad(ctx, partial, stats, habit.color, time, 0.58);
    drawOvergrowth(ctx, partial, stats, time, 0.55);
  });

  habits.forEach((habit, index) => {
    const stats = computeStats(habit);
    const points = createPathPoints(habit, width, height, index, habits.length, true);
    const partial = getPartialPath(points, stats.roadLength);
    const end = partial[partial.length - 1];
    if (!end) return;
    drawRouteMarker(ctx, end.x, end.y, habit.color, Math.round(stats.strength));
  });
}

function drawSelectedRoad(ctx, width, height, time) {
  const habit = getSelectedHabit();

  if (!habit) {
    drawTrees(ctx, width, height, [], 1.05, "empty-forest", time);
    return;
  }

  const stats = computeStats(habit);
  const points = createPathPoints(habit, width, height, 0, 1, false);
  const partial = getPartialPath(points, stats.roadLength);
  const corridor = partial.map((point) => ({ ...point }));

  drawTrees(ctx, width, height, corridor, stats.density, habit.id, time);
  drawRoad(ctx, partial, stats, habit.color, time, 1);
  drawRoadDetails(ctx, partial, stats, habit, time);
  drawOvergrowth(ctx, partial, stats, time, 1);
}

function drawTrees(ctx, width, height, pathPoints, density, seed, time) {
  const rng = seededRandom(`trees-${seed}`);
  const count = Math.round((width * height) / 1400 * clamp(density, 0.25, 1.2));
  const colors = ["#143524", "#1d4b37", "#285f42", "#476f42", "#6c854e"];

  for (let i = 0; i < count; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    const perspective = 0.55 + (y / height) * 1.25;
    const size = (8 + rng() * 24) * perspective;
    const distance = pathPoints.length > 1 ? distanceToPath(x, y, pathPoints) : Infinity;
    const clearRadius = 14 + size * 0.32 + (pathPoints.length > 1 ? 8 : 0);
    const nearPath = distance < clearRadius * 2.4;

    if (nearPath && rng() < 0.86 - density * 0.24) continue;
    if (distance < clearRadius && rng() < 0.95) continue;

    const sway = Math.sin(time * 0.9 + x * 0.02 + y * 0.01) * 1.3;
    const color = colors[Math.floor(rng() * colors.length)];
    drawTree(ctx, x, y, size, color, sway, rng());
  }
}

function drawTree(ctx, x, y, size, color, sway, variant) {
  const trunkHeight = size * 0.55;
  const crownHeight = size * (variant > 0.65 ? 1.3 : 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(49, 34, 24, 0.72)";
  ctx.fillRect(-size * 0.08, -trunkHeight * 0.18, size * 0.16, trunkHeight);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(sway, -crownHeight);
  ctx.lineTo(-size * 0.52, size * 0.2);
  ctx.lineTo(size * 0.52, size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.58;
  ctx.fillStyle = "#8ba866";
  ctx.beginPath();
  ctx.moveTo(sway * 0.4, -crownHeight * 0.82);
  ctx.lineTo(-size * 0.32, -size * 0.03);
  ctx.lineTo(size * 0.22, -size * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRoad(ctx, points, stats, color, time, scale) {
  if (points.length < 2) return;

  const roadWidth = Math.max(3, stats.roadWidth * scale);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stats.strength < 18) {
    ctx.setLineDash([6, 12]);
    ctx.strokeStyle = "rgba(205, 159, 101, 0.58)";
    ctx.lineWidth = Math.max(3, roadWidth * 0.34);
    strokePath(ctx, points);
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = "rgba(35, 25, 18, 0.38)";
    ctx.lineWidth = roadWidth * 1.34;
    strokePath(ctx, points);

    const roadGradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    roadGradient.addColorStop(0, "#a7754e");
    roadGradient.addColorStop(0.55, "#7c5939");
    roadGradient.addColorStop(1, "#5d422c");
    ctx.strokeStyle = roadGradient;
    ctx.lineWidth = roadWidth;
    strokePath(ctx, points);

    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, roadWidth * 0.1);
    strokePath(ctx, points);
    ctx.globalAlpha = 1;
  }

  if (stats.strength > 42) {
    ctx.globalAlpha = 0.24;
    ctx.strokeStyle = "#f1d09d";
    ctx.lineWidth = Math.max(1, roadWidth * 0.08);
    const left = offsetPath(points, roadWidth * 0.28);
    const right = offsetPath(points, -roadWidth * 0.28);
    strokePath(ctx, left);
    strokePath(ctx, right);
  }

  ctx.restore();
}

function drawRoadDetails(ctx, points, stats, habit, time) {
  if (points.length < 2) return;
  const rng = seededRandom(`details-${habit.id}`);
  const markers = Math.min(9, Math.max(1, Math.floor(stats.doneCount / 7)));

  ctx.save();
  for (let i = 0; i < markers; i += 1) {
    const point = getPointAt(points, (i + 1) / (markers + 1));
    if (!point) continue;
    const side = i % 2 === 0 ? 1 : -1;
    drawFlag(ctx, point.x + side * (stats.roadWidth * 0.62 + 10), point.y, habit.color, time + i);
  }

  if (stats.strength > 30) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#d7b98a";
    for (let i = 0; i < 42; i += 1) {
      const point = getPointAt(points, rng());
      if (!point) continue;
      const spread = (rng() - 0.5) * stats.roadWidth * 0.72;
      ctx.beginPath();
      ctx.ellipse(point.x + spread, point.y + (rng() - 0.5) * 10, 1 + rng() * 2.4, 0.8 + rng() * 1.6, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawOvergrowth(ctx, points, stats, time, scale) {
  if (points.length < 2) return;

  const pressure = clamp((100 - stats.strength) / 100 + stats.decayPressure / 80, 0, 1.35);
  const blades = Math.round(28 * pressure * scale + stats.missedRecent * 8);
  const rng = seededRandom(`growth-${points.length}-${Math.round(stats.strength)}-${Math.round(stats.decayPressure)}`);

  ctx.save();
  ctx.lineCap = "round";
  for (let i = 0; i < blades; i += 1) {
    const point = getPointAt(points, rng());
    if (!point) continue;
    const angle = -Math.PI / 2 + (rng() - 0.5) * 1.6;
    const length = (8 + rng() * 24) * scale * pressure;
    const offset = (rng() - 0.5) * (stats.roadWidth * 0.95 + 22);
    const x = point.x + offset;
    const y = point.y + (rng() - 0.5) * 12;
    ctx.strokeStyle = rng() > 0.5 ? "rgba(126, 161, 90, 0.78)" : "rgba(39, 95, 66, 0.82)";
    ctx.lineWidth = 1 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(angle) * length * 0.5, y - length * 0.4, x + Math.cos(angle) * length, y - length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlag(ctx, x, y, color, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(25, 18, 13, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(0, -15);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(18 + Math.sin(time) * 2, -10);
  ctx.lineTo(0, -5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRouteMarker(ctx, x, y, color, score) {
  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 20, 0.72)";
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fbfff8";
  ctx.font = "700 10px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${score}`, x, y + 1);
  ctx.restore();
}

function drawAtmosphere(ctx, width, height, time) {
  ctx.save();
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, height * 0.2, width * 0.5, height * 0.52, width * 0.78);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(3, 9, 6, 0.58)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#f8f4dc";
  for (let i = 0; i < 26; i += 1) {
    const x = (Math.sin(time * 0.12 + i * 9.7) * 0.5 + 0.5) * width;
    const y = ((time * 7 + i * 43) % (height + 80)) - 40;
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function createPathPoints(habit, width, height, index, total, overview) {
  const rng = seededRandom(`path-${habit.id}`);
  const points = [];
  const segments = overview ? 8 : 10;
  const spread = overview ? width * 0.78 : width * 0.42;
  const startBase = overview ? width * (0.11 + ((index + 0.5) / Math.max(1, total)) * 0.78) : width * 0.5;
  const endBase = overview ? width * (0.16 + rng() * 0.68) : width * (0.32 + rng() * 0.36);
  const wave = 0.8 + rng() * 1.4;
  const phase = rng() * Math.PI * 2;

  for (let i = 0; i < segments; i += 1) {
    const t = i / (segments - 1);
    const y = height * (1.08 - t * 1.18);
    const base = lerp(startBase, endBase, t);
    const noise = Math.sin(t * Math.PI * wave + phase) * spread * 0.13 + (rng() - 0.5) * spread * 0.13;
    points.push({
      x: clamp(base + noise, width * 0.08, width * 0.92),
      y,
    });
  }

  return points;
}

function strokePath(ctx, points) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[i - 1];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    ctx.quadraticCurveTo(previous.x, previous.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function getPartialPath(points, fraction) {
  if (points.length < 2) return points;
  const target = getPathLength(points) * clamp(fraction, 0, 1);
  const partial = [points[0]];
  let travelled = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segment = distance(a.x, a.y, b.x, b.y);
    if (travelled + segment < target) {
      partial.push(b);
      travelled += segment;
      continue;
    }

    const remaining = target - travelled;
    const t = segment ? remaining / segment : 0;
    partial.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
    break;
  }

  return partial.length > 1 ? partial : [points[0], points[1]];
}

function getPathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += distance(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  }
  return length;
}

function getPointAt(points, fraction) {
  if (points.length < 2) return points[0] || null;
  const target = getPathLength(points) * clamp(fraction, 0, 1);
  let travelled = 0;

  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const segment = distance(a.x, a.y, b.x, b.y);
    if (travelled + segment >= target) {
      const t = segment ? (target - travelled) / segment : 0;
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
    }
    travelled += segment;
  }

  return points[points.length - 1];
}

function offsetPath(points, amount) {
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x || 1;
    const dy = next.y - previous.y || 1;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (-dy / len) * amount,
      y: point.y + (dx / len) * amount,
    };
  });
}

function distanceToPath(x, y, points) {
  let min = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    min = Math.min(min, distanceToSegment(x, y, a.x, a.y, b.x, b.y));
  }
  return min;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return distance(px, py, ax, ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  return distance(px, py, ax + t * dx, ay + t * dy);
}

function seededRandom(seed) {
  let hash = 2166136261;
  const seedString = String(seed);
  for (let i = 0; i < seedString.length; i += 1) {
    hash ^= seedString.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDateRange(startISO, endISO) {
  const dates = [];
  let cursor = startISO;
  while (compareISO(cursor, endISO) <= 0) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function getTodayISO() {
  return toISO(new Date());
}

function toISO(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function fromISO(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(iso, amount) {
  const date = fromISO(iso);
  date.setDate(date.getDate() + amount);
  return toISO(date);
}

function diffDays(startISO, endISO) {
  return Math.round((fromISO(endISO) - fromISO(startISO)) / MS_PER_DAY);
}

function compareISO(a, b) {
  return a.localeCompare(b);
}

function minISO(a, b) {
  return compareISO(a, b) <= 0 ? a : b;
}

function formatWeekday(iso) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(fromISO(iso)).replace(".", "");
}

function formatLongDate(iso) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(fromISO(iso));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function createId(prefix = "habit") {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value));
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitials(value) {
  const words = String(value || "Forest Roads")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase()).join("") || "FR";
}

function showToast(message) {
  if (currentToast) currentToast.remove();
  currentToast = document.createElement("div");
  currentToast.className = "toast";
  currentToast.textContent = message;
  document.body.appendChild(currentToast);
  window.setTimeout(() => {
    currentToast?.remove();
    currentToast = null;
  }, 2600);
}
