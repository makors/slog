type JoinCodeClaimedEvent = {
  project: {
    id: string;
    name: string;
  };
};

type JoinCodeListener = (event: JoinCodeClaimedEvent) => void;

declare global {
  var __slogJoinCodeListeners:
    | Map<string, Set<JoinCodeListener>>
    | undefined;
}

function listeners() {
  globalThis.__slogJoinCodeListeners ??= new Map();
  return globalThis.__slogJoinCodeListeners;
}

export function subscribeJoinCode(
  code: string,
  listener: JoinCodeListener,
) {
  const map = listeners();
  const set = map.get(code) ?? new Set<JoinCodeListener>();
  set.add(listener);
  map.set(code, set);

  return () => {
    set.delete(listener);
    if (set.size === 0) map.delete(code);
  };
}

export function publishJoinCodeClaimed(
  code: string,
  event: JoinCodeClaimedEvent,
) {
  const set = listeners().get(code);
  if (!set) return;

  for (const listener of [...set]) {
    listener(event);
  }
}
