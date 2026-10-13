export function normalizeGameView(view: string): string {
  if (view === 'sectContribution') {
    return 'sect';
  }

  return view;
}
