export function createEmptyState() {
  return {
    version: 1,
    title: "",
    description: "",
    sourceName: "",
    importedAt: null,
    contents: [],
    progressByQuestionId: {},
    history: []
  };
}

export function createEmptyUiState() {
  return {
    feed: [],
    activeIndex: 0,
    menuOpen: false,
    notice: "",
    busyLabel: "",
    answeredQuestionIds: {}
  };
}
